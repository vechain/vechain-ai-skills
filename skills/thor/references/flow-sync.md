# Chain Synchronization Flow

How a node discovers peers, downloads blocks, validates them, and handles forks.

## Overview

```
p2p/p2psrv/ → comm/ → consensus/ → chain/ → bft/
     │           │          │          │       │
  Discover    Download   Validate   Store   Finalize
```

## Step 1: Peer Discovery and Connection

**Package:** `p2p/`, `p2psrv/`

The P2P layer uses a devp2p-compatible stack with Kademlia-based discovery (discv5).

**Discovery topic:** `thor1@<last8bytes_of_genesisID>` — ensures peers are on the same network.

**Handshake** (`Communicator.runPeer`):
1. 5-second timeout for status exchange
2. Verify `GenesisBlockID` matches
3. Verify system clock diff ≤ `2 × BlockInterval`
4. Exchange `{BestBlockID, TotalScore, SysTimestamp}`
5. Add to `PeerSet`, track head block and total score

**Key types:**
- `comm.Communicator` — orchestrates sync, tx relay, block announcements
- `comm.Peer` — wraps `p2p.Peer` with block/tx knowledge tracking
- `comm.PeerSet` — thread-safe peer collection with filtering

## Step 2: Initial Sync

**Package:** `comm/communicator.go`, `comm/sync.go`

`Communicator.Sync()` runs a timer-based sync loop:

```
1. Find peer with TotalScore ≥ our best block's TotalScore
2. download(ctx, repo, peer, headNum, handler) → stream blocks
3. Repeat until synced (best block time + BlockInterval ≥ now, or >2 sync rounds)
4. Close syncedCh → triggers packer loop and tx sync
```

### Download Pipeline (Three-Stage)

```
Stage 1: fetchRawBlockBatches    → rawBatches channel (cap 10)
Stage 2: decodeAndWarmupBatches  → warmedUp channel (cap 2048)
Stage 3: handler (processBlock)  → commit to chain
```

**Stage 1** — fetches raw RLP-encoded blocks from peer via `proto.GetBlocksFromNumber`:
- Requests blocks starting from `ancestor + 1`
- Batches of raw bytes sent to channel
- Stops when peer returns empty result

**Stage 2** — decodes and pre-warms caches in parallel:
- RLP decode each block
- Verify block number sequence
- Parallel cache warm-up: `header.ID()`, `header.Beta()`, `tx.ID()`, `tx.IntrinsicGas()`, `tx.Delegator()`
- Throttling: inserts nil blocks when buffer > 10% full to reduce memory pressure

**Stage 3** — `node.handleBlockStream` processes each block through `processBlock`

### Common Ancestor Discovery

`findCommonAncestor(ctx, repo, peer, headNum)`:

1. **Fast seek:** Exponential backward scan (1, 2, 4, 8, ... blocks back) using `proto.GetBlockIDByNumber`
2. **Binary search:** Between fast-seek result and head, find exact fork point
3. Returns the highest block number both nodes agree on

## Step 3: Block Processing During Sync

**Package:** `cmd/thor/node/block_exec.go`

`Node.processBlock(block, stats)`:

1. **Guard processing:** Lock + conflict detection
   - If `blockNum > maxBlockNum + 1` → `errBlockTemporaryUnprocessable`
   - Otherwise, count existing blocks at same height (`ScanConflicts`)

2. **BFT acceptance:** `bft.Accepts(parentID)` — reject if parent not on finalized branch

3. **Consensus processing:** `consensus.Process(parentSummary, block, now, conflicts)` → `stage, receipts`
   - Full header, proposer, body, and execution validation (see block production flow)

4. **Fork choice:**
   - Post-FINALITY: `bft.Select(header)` — quality-based selection
   - Pre-FINALITY: `header.BetterThan(prevBest)` — total score comparison

5. **Commit:** `commitBlock(ctx)`:
   - Write logs to `logdb` (if becoming best and logs enabled)
   - `stage.Commit()` — persist state trie
   - `repo.AddBlock(block, receipts, conflicts, becomeBest)`
   - `bft.CommitBlock(header, isPacking=false)`
   - If becoming best: `processFork` to re-add orphaned txs

### Error Handling

| Error | Action |
|-------|--------|
| `errKnownBlock` | Ignore (already stored) |
| `errFutureBlock` | Queue (block timestamp too far ahead) |
| `errParentMissing` | Queue (parent not yet received) |
| `errBlockTemporaryUnprocessable` | Queue (block number too far ahead) |
| `errBFTRejected` | Discard (conflicts with finalized checkpoint) |
| Consensus critical error | Log error, discard block |

## Step 4: Steady-State Block Propagation

**Package:** `comm/communicator.go`, `comm/announcement_loop.go`

Once synced, new blocks arrive via two mechanisms:

### Direct Block Push

Peers call `proto.NotifyNewBlock(peer, block)` — sends full block to √N random peers:

```go
p := int(math.Sqrt(float64(len(peers))))
toPropagate := peers[:p]   // send full block
toAnnounce := peers[p:]    // send just block ID
```

### Block ID Announcement

Remaining peers receive just the block ID via `proto.NotifyNewBlockID`. The announcement loop processes these:

1. Receive announcement with `{blockID, senderPeer}`
2. If block unknown: fetch from peer via `proto.GetBlockByID`
3. Process via `processBlock`
4. If accepted as trunk: broadcast to our peers

### Transaction Propagation

**Package:** `comm/txs_loop.go`

- After sync completes: `syncTxs(peer)` — bulk fetch txs from connected peer
- Ongoing: `txFeed` subscription relays new executable txs to peers
- Peer tracking: `peer.MarkTransaction(hash)` prevents duplicate sends

## Step 5: Fork Handling

### Fork Detection

Forks are detected when `processBlock` finds the new block becomes best but the previous best was at the same height on a different branch.

### Fork Resolution

`Node.processFork(newBlock, oldBestBlockID)`:

```go
oldTrunk := repo.NewChain(oldBestBlockID)
newTrunk := repo.NewChain(newBlock.ParentID())
sideIDs := oldTrunk.Exclude(newTrunk)  // blocks on old branch not on new

for _, id := range sideIDs {
    block := repo.GetBlock(id)
    for _, tx := range block.Transactions() {
        txPool.Add(tx)  // re-add orphaned txs to pool
    }
}
```

The `Chain.Exclude(other)` method walks backwards from the chain head, finding blocks present in one chain but not the other.

### Log Rewriting on Fork

```go
oldBranch := oldTrunk.Exclude(newTrunk)
if len(oldBranch) > 0 {
    logDB.Writer.Truncate(forkPoint)  // remove old branch logs
}
newBranch := newTrunk.Exclude(oldTrunk)
for _, id := range newBranch {
    logDB.Writer.Write(block, receipts)  // write new branch logs
}
```

### BFT Finality and Fork Prevention

Post-FINALITY fork, the BFT engine prevents deep reorgs:

- `bft.Accepts(parentID)` rejects blocks whose parent is not a descendant of the finalized checkpoint
- `bft.Select(header)` prefers higher quality (more epoch votes) over total score
- Once a checkpoint is finalized, all blocks not descending from it are permanently rejected

## Node Startup Sequence

**Package:** `cmd/thor/node/node.go`

```go
func (n *Node) Run(ctx context.Context) error {
    maxBlockNum := repo.GetMaxBlockNum()
    txStash := newTxStash(db, 1000)

    // Four concurrent goroutines:
    go n.comm.Sync(ctx, n.handleBlockStream)  // sync + block processing
    go n.houseKeeping(ctx)                     // periodic maintenance
    go n.txStashLoop(ctx, txStash)             // persist non-executable txs
    go n.packerLoop(ctx)                       // block production (waits for sync)
}
```

The `packerLoop` blocks on `comm.Synced()` channel before starting block production.

## Protocol Messages

**Package:** `comm/proto/`

| Message | Direction | Purpose |
|---------|-----------|---------|
| `GetStatus` | Request | Exchange genesis ID, best block, total score |
| `GetBlocksFromNumber` | Request | Batch download blocks for sync |
| `GetBlockIDByNumber` | Request | Common ancestor discovery |
| `GetBlockByID` | Request | Fetch single block |
| `NotifyNewBlock` | Push | Propagate full block |
| `NotifyNewBlockID` | Push | Announce new block (lightweight) |
| `GetTxs` | Request | Bulk tx sync after initial sync |
| `NotifyNewTx` | Push | Relay new executable transaction |
