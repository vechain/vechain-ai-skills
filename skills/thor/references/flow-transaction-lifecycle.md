# Transaction Lifecycle Flow

End-to-end journey of a transaction from submission to on-chain finality.

## Overview

```
API/P2P → txpool/ → packer/ → runtime/ → chain/ → logdb/
  │          │          │          │          │         │
Receive  Validate   Select    Execute    Store    Index logs
```

## Step 1: Transaction Receipt

Transactions enter the node through two paths:

| Entry Point | Package | Method |
|-------------|---------|--------|
| REST API `POST /transactions` | `api/transactions/` | `TxPool.AddLocal(tx)` |
| P2P propagation | `comm/handle_rpc.go` | `TxPool.Add(tx)` or `TxPool.StrictlyAdd(tx)` |
| Sync from peer | `comm/sync.go` | `TxPool.StrictlyAdd(tx)` |

## Step 2: Transaction Types

**Package:** `tx/`

Two transaction types (starting from Galactica fork):

| Field | `TypeLegacy` (0x00) | `TypeDynamicFee` (0x51) |
|-------|---------------------|------------------------|
| Gas pricing | `GasPriceCoef` (0–255) over `BaseGasPrice` | `MaxFeePerGas` + `MaxPriorityFeePerGas` |
| Encoding | RLP list | Type-prefix + RLP |
| Work proofs | `ProvedWork` for priority boost | Not applicable |

**Common fields** (both types):
- `ChainTag` — last byte of genesis ID
- `BlockRef` — first 8 bytes of a recent block hash (establishes tx validity window)
- `Expiration` — valid from `BlockRef.Number` to `BlockRef.Number + Expiration`
- `Clauses` — array of `{To, Value, Data}` (multi-clause model)
- `Gas` — max gas
- `DependsOn` — optional tx dependency
- `Nonce` — replay protection (not sequential like Ethereum)
- `Reserved` — feature flags (e.g., `DelegationFeature` for VIP-191)

**Key types:**
- `tx.Transaction` — immutable, caches signingHash/origin/id/intrinsicGas
- `tx.Clause` — `{To *Address, Value *big.Int, Data []byte}`
- `tx.BlockRef` — 8-byte block reference
- `tx.Features` — bit flags (delegation support)

**ID calculation:** `tx.ID = Blake2b(signingHash, origin)` — unique per sender.

## Step 3: TxPool Validation and Storage

**Package:** `txpool/`

`TxPool.add()` performs staged validation:

### Static validation (`validateTxBasics`)
1. Signature low-S check (`EnforceSignatureLowS`)
2. Chain tag matches `repo.ChainTag()`
3. Size ≤ `MaxTxSize` (64 KB)

### Blocklist check
- Origin and delegator checked against both hardcoded blocklist and fetched blocklist

### Resolution
`ResolveTx(tx)` → `TxObject` with computed `origin`, `priorityGasPrice`

### Executability check (when chain is synced)
`TxObject.Executable()` verifies against current state:
- Tx not already on chain
- Block ref in valid range, not expired
- Dependencies resolved (not reverted)
- Sufficient VTHO balance for gas cost
- Post-Galactica: effective gas price ≥ baseFee

### Pool management
- Pool limit: `Options.Limit` (default ~10k)
- Per-account limit: `Options.LimitPerAccount`
- Non-executable cap: 20% of pool limit
- Priority eviction: sorted by `priorityGasPrice` descending

### Housekeeping (every second)
The `wash()` routine:
1. Removes expired, settled, blocked, energy-depleted txs
2. Recalculates `priorityGasPrice` when baseFee changes
3. Produces sorted `Executables()` list for the packer

**Key types:**
- `txpool.TxPool` — `{all *txObjectMap, executables atomic.Value}`
- `txpool.TxObject` — wraps `tx.Transaction` with `executable bool`, `priorityGasPrice`
- `txpool.TxEvent` — `{Tx, Executable *bool}` — published to subscribers (comm layer for P2P broadcast)

## Step 4: Transaction Selection for Block

**Package:** `packer/`

In `proposeAndCommit` (node packer loop):

```go
txs := n.txPool.Executables()  // sorted by priority gas price desc
for _, tx := range txs {
    err := flow.Adopt(tx)
    if packer.IsGasLimitReached(err) { break }
    if packer.IsTxNotAdoptableNow(err) { continue }
    // bad tx → mark for removal
}
```

`Flow.Adopt` performs final checks (see block production flow) and calls `runtime.ExecuteTransaction`.

Error categories:
- `badTxError` — permanent rejection (wrong chain tag, expired, blocked origin)
- `errTxNotAdoptableNow` — temporary (future block ref, gas too high for remaining space)
- `errGasLimitReached` — block full, stop adopting
- `errKnownTx` — already on chain

## Step 5: Clause Execution

**Package:** `runtime/`

VeChain's multi-clause model executes multiple operations atomically in one tx.

### Execution flow per transaction

```
ResolveTransaction(tx) → ResolvedTransaction
  └─ BuyGas(state, blockTime, baseFee) → deduct VTHO from payer
     └─ For each clause:
        └─ PrepareClause → EVM.Call or EVM.Create
           └─ Output{Events, Transfers, LeftOverGas, VMErr}
     └─ Finalize → Receipt
```

### Gas payer resolution order (BuyGas)
1. **Delegator** (VIP-191) — if tx has delegation feature + delegator signature
2. **Sponsor** — if all clauses share same `To` and user has credit via `Prototype.Bind`
3. **Contract `To`** — if sponsor insufficient but user has credit
4. **Origin** — fallback

### Clause execution detail
- Each clause gets its own EVM instance via `PrepareClause`
- Contract creation: `clause.To == nil` → `EVM.Create`
- Native contract calls intercepted via `InterceptContractCall` (builtin contracts)
- On any clause VM error: **all clauses revert** to checkpoint

### Receipt generation
```go
Receipt{
    Type:     tx.Type(),
    Reverted: reverted,
    Outputs:  []{Events, Transfers},  // nil if reverted
    GasUsed:  tx.Gas() - leftOverGas,
    GasPayer: payer,
    Paid:     gasUsed * effectiveGasPrice,
    Reward:   priorityFeePerGas * gasUsed,  // post-Galactica
}
```

## Step 6: Storage and Indexing

### Block storage (`chain/`)
When the block is committed via `Repository.AddBlock`:
- Tx blobs → `bodyStore` keyed by `(blockNum, conflicts, index, txFlag)`
- Receipt blobs → `bodyStore` keyed by `(blockNum, conflicts, index, receiptFlag)`
- Tx metadata → `txIndexer` keyed by `txID + varint(blockNum) + varint(conflicts)`
- Filter key → `txIndexer` keyed by first 8 bytes of txID (bloom-like fast lookup)

### Log indexing (`logdb/`)
`LogDB` (SQLite) indexes events and transfers for query:
- **Events table:** `blockNum, txIndex, clauseIndex, address, topic0–4, data`
- **Transfers table:** `blockNum, txIndex, clauseIndex, sender, recipient, amount`
- Written by `node.writeLogs()` → `logdb.Writer.Write(block, receipts)`
- On fork: `Writer.Truncate(forkPoint)` then re-write new branch

## Step 7: Query

Transactions become queryable via:

| Endpoint | Source | Key |
|----------|--------|-----|
| `GET /transactions/{id}` | `chain.Chain.GetTransaction(id)` | txID → txMeta → tx blob |
| `GET /transactions/{id}/receipt` | `chain.Chain.GetTransactionReceipt(id)` | txID → txMeta → receipt blob |
| `POST /logs/event` | `logdb.LogDB.FilterEvents()` | SQLite query with address/topic filters |
| `POST /logs/transfer` | `logdb.LogDB.FilterTransfers()` | SQLite query with sender/recipient filters |

## Error Paths Summary

| Stage | Error | Result |
|-------|-------|--------|
| TxPool add | Bad signature, wrong chain tag, too large | `badTxError` — rejected |
| TxPool add | Pool full, non-executable | `txRejectedError` — rejected |
| TxPool wash | Expired, settled, insufficient energy | Removed from pool |
| Packer adopt | Expired, duplicate, gas limit | Skip or stop packing |
| Runtime execute | Intrinsic gas > provided gas | Tx not included |
| Runtime clause | VM revert/error | Receipt with `Reverted: true`, all clauses rolled back |
| Consensus verify | Mismatched receipts root, state root | Block rejected |
