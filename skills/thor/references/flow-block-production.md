# Block Production Flow

How a new block is produced in VeChainThor, from scheduling through finality.

## Overview

```
scheduler/ → packer/ → runtime/ → consensus/ → bft/ → chain/
   │            │          │           │          │       │
Schedule    Assemble   Execute    Validate    Vote    Store
```

## Step 1: Scheduling — Who Proposes Next

**Package:** `scheduler/`, `packer/pos_scheduler.go`, `packer/poa_scheduler.go`

The node's `packerLoop` (in `cmd/thor/node/packer_loop.go`) continuously calls `Packer.Schedule()` to determine when this node should propose.

| Type | Scheduler | Selection Method |
|------|-----------|-----------------|
| PoA (pre-Galactica) | `PoASchedulerV1` / `PoASchedulerV2` | Round-robin from `Authority` candidates with endorsement balance check |
| PoS (post-Galactica) | `PoSScheduler` | Weighted random sampling (A-Res reservoir) from `Staker.LeaderGroup()` |

**Key types:**
- `scheduler.Scheduler` — interface: `Schedule(nowTime) → newBlockTime`, `IsTheTime()`, `Updates()`
- `scheduler.Proposer` — `{Address, Active, Weight}`
- `scheduler.Seeder` — generates deterministic VRF-based seeds per block

**PoS scheduling detail:** `NewPoSScheduler` generates a deterministic shuffle using `ChaCha8` PRNG seeded with `Blake2b(VRF_seed, blockNumber)`. Each validator gets score `-ln(random)/weight` (A-Res algorithm). Validators sorted by score determine the slot order.

**Triggers next:** `Packer.Schedule()` returns a `*Flow` with the target block time.

## Step 2: Packing — Assembling the Block

**Package:** `packer/`

`Packer.Schedule()` determines consensus mode (PoA vs PoS) by calling `Staker.SyncPOS()`, then delegates to `schedulePOS` or `schedulePOA`. Both return `(beneficiary, newBlockTime, score)`.

A `Flow` is created with a `runtime.Runtime` initialized with:

```go
xenv.BlockContext{
    Beneficiary, Signer, Number, Time,
    GasLimit, TotalScore, BaseFee,
}
```

**Transaction adoption** (`Flow.Adopt`):
1. Check blocklist, chain tag, block ref, expiration
2. Check gas capacity (`gasUsed + tx.Gas ≤ GasLimit`)
3. Post-Galactica: validate `EffectiveGasPrice ≥ BaseFee` and priority fee
4. Check tx not duplicate, dependency resolved
5. Create state checkpoint → `runtime.ExecuteTransaction(tx)` → on error, revert
6. Accumulate `gasUsed`, append to `txs` and `receipts`

The `packerLoop` calls `flow.Adopt(tx)` for each executable tx from the pool, stopping at `errGasLimitReached`.

**Key types:**
- `packer.Packer` — holds repo, stater, nodeMaster, beneficiary, forkConfig
- `packer.Flow` — accumulates txs/receipts, tracks gas, calls runtime

**Triggers next:** `Flow.Pack(privateKey, conflicts, shouldVote)` builds and signs the block.

## Step 3: Runtime Execution

**Package:** `runtime/`

`Runtime.ExecuteTransaction` resolves the tx, buys gas (VTHO), then executes each clause sequentially.

**Per-clause execution:**
1. `PrepareClause` creates a `statedb.StateDB` and EVM instance
2. If `clause.To() == nil` → contract creation; else → `evm.Call`
3. Collects `Output{Data, Events, Transfers, LeftOverGas, VMErr}`
4. On VM error → revert all clauses to checkpoint, mark `receipt.Reverted = true`

**Gas payment:** `ResolvedTransaction.BuyGas` deducts VTHO from payer (delegator → sponsor → origin fallback).

**Reward calculation (post-Galactica):**
- `priorityFeePerGas = min(maxFeePerGas - baseFee, maxPriorityFeePerGas)`
- `receipt.Reward = priorityFeePerGas × gasUsed`
- Reward credited to `Beneficiary` via `Energy.Add`

**Key types:**
- `runtime.Runtime` — wraps EVM, chain, state, block context
- `runtime.ResolvedTransaction` — resolved origin, delegator, intrinsic gas, clauses
- `runtime.TransactionExecutor` — iterator over clauses with `HasNextClause/PrepareNext/Finalize`
- `tx.Receipt` — `{Type, Reverted, Outputs, GasUsed, GasPayer, Paid, Reward}`

## Step 4: Consensus Validation

**Package:** `consensus/`

When receiving a block (not packing), `Consensus.Process()` validates it:

1. **Header validation** (`validateBlockHeader`):
   - Timestamp > parent, aligned to `BlockInterval`
   - Not future (≤ now + BlockInterval)
   - GasUsed ≤ GasLimit, valid gas limit delta
   - TotalScore > parent
   - Signature length (65 bytes pre-VIP214, complex sig post-VIP214)
   - BaseFee matches `galactica.CalcBaseFee(parent)` post-Galactica

2. **Proposer validation**:
   - **PoA:** `validateAuthorityProposer` — checks signer is in Authority candidates, scheduled for this slot
   - **PoS:** `validateStakingProposer` — checks signer is in `Staker.LeaderGroup()`, scheduled via `PoSScheduler`
   - Both verify `TotalScore = parent.TotalScore + score`

3. **Body validation** (`validateBlockBody`):
   - `TxsRoot` matches merkle root of txs
   - Each tx: valid origin, chain tag, block ref, expiration, features

4. **Block verification** (`verifyBlock`):
   - Re-execute all txs via `runtime.ExecuteTransaction`
   - Verify `GasUsed`, `ReceiptsRoot`, `StateRoot` all match header
   - Post-PoS: distribute rewards via `Energy.DistributeRewards`

**Key types:**
- `consensus.Consensus` — holds repo, stater, seeder, forkConfig, validatorsCache

## Step 5: BFT Finality

**Package:** `bft/`

The `bft.Engine` implements VIP-220 finality (epoch-based voting).

**Concepts:**
- **Epoch:** `EpochLength` blocks (e.g., 100). Checkpoint = first block of epoch.
- **COM bit:** Block header flag indicating the proposer votes for current checkpoint.
- **Quality:** Count of epochs with sufficient votes. Stored at `storePoint` (last block of epoch).
- **Justified:** Checkpoint with quality ≥ threshold for current epoch.
- **Finalized:** When quality > 1, `findCheckpointByQuality(quality-1)` is finalized.

**Key operations:**
- `ShouldVote(parentID)` — packer checks before setting COM bit
- `CommitBlock(header, isPacking)` — saves quality at epoch end, updates finalized
- `Select(header)` — fork choice: prefer higher quality, then `BetterThan`
- `Accepts(parentID)` — rejects blocks not descending from finalized checkpoint

**Key types:**
- `bft.Committer` — interface for `Engine`
- `bft.Engine` — tracks casts (votes), finalized/justified checkpoints
- `bft.justifier` — per-epoch vote accumulator

## Step 6: Chain Storage

**Package:** `chain/`

`Repository.AddBlock(block, receipts, conflicts, asBest)`:

1. **Index block:** Update index trie (block number → block ID mapping)
2. **Save block:**
   - Header summary → `hdrStore`
   - Tx blobs → `bodyStore`
   - Receipt blobs → `bodyStore`
   - Tx metadata (index, reverted) → `txIndexer`
   - Chain head → `headStore`
3. If `asBest`: update `bestBlockID` in `propStore`, broadcast via `tick.Signal`

**Key types:**
- `chain.Repository` — thread-safe block/tx/receipt storage over `muxdb.MuxDB`
- `chain.Chain` — linked chain view from genesis to a given head, backed by index trie
- `chain.BlockSummary` — `{Header, Txs []Bytes32, Size, Conflicts}`
- `chain.TxMeta` — `{BlockNum, BlockConflicts, Index, Reverted}`

## End-to-End Sequence (Packing Path)

```
1. packerLoop waits for sync, then loops:
2. Packer.Schedule(bestBlock, now) → Flow
3. Wait until flow.When() - BlockInterval/2
4. For each txPool.Executables(): flow.Adopt(tx)
5. bft.ShouldVote() → shouldVote
6. flow.Pack(privateKey, conflicts, shouldVote) → block, stage, receipts
7. stage.Commit() → persist state trie
8. repo.AddBlock(block, receipts) → persist to DB
9. bft.CommitBlock(header, isPacking) → update finality
10. comm.BroadcastBlock(block) → propagate to peers
```

## End-to-End Sequence (Receiving Path)

```
1. comm.Sync downloads blocks from peers → handleBlockStream
2. node.processBlock(block):
3. bft.Accepts(parentID) → reject if not on finalized branch
4. consensus.Process(parent, block, now, conflicts) → stage, receipts
5. bft.Select(header) → fork choice (becomeBest?)
6. node.commitBlock: stage.Commit(), repo.AddBlock(), bft.CommitBlock()
7. If becomeBest: processFork (re-add orphaned txs to pool)
```
