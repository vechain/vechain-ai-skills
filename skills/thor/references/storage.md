# Storage Architecture

Thor uses a layered storage design: **MuxDB** (LevelDB) for blockchain state and chain data,
**LogDB** (SQLite) for event/transfer logs, and a Merkle-Patricia trie for state management.

## MuxDB — Main Database

Central storage abstraction in `muxdb/`. Wraps LevelDB and manages trie nodes + named KV stores.

### Key Spaces

| Space | Byte Prefix | Purpose |
|-------|-------------|---------|
| `trieHistSpace` | 0 | Historical trie nodes (versioned, prunable) |
| `trieDedupedSpace` | 1 | Deduplicated trie nodes (checkpointed, permanent) |
| `namedStoreSpace` | 2 | Named KV stores for chain data |

### Named KV Stores

| Store | Contents |
|-------|----------|
| `chain.hdr` | Block headers |
| `chain.body` | Block bodies |
| `chain.props` | Chain properties |
| `chain.heads` | Chain head pointers |
| `chain.txi` | Transaction index |
| `state.code` | Contract bytecode |
| `muxdb.props` | DB config (partition factors) |
| `pruner.props` | Pruner checkpoint state |

### Trie Names

| Name | Purpose |
|------|---------|
| `"a"` | Account trie (address → account + metadata) |
| `"i"` | Index trie (block index) |
| `"s"` + storageID | Per-contract storage tries |

## LevelDB — Underlying Engine

Engine: `syndtr/goleveldb` via `engine.LevelEngine`.

| Setting | Default | Description |
|---------|---------|-------------|
| BlockCacheCapacity | `ReadCacheMB` (256 MB) | Read cache |
| WriteBuffer | `WriteBufferMB` (128 MB) | Write buffer |
| Filter | Bloom 10-bit | Block filter |
| BlockSize | 32 KB | Data block size |
| CompactionTableSize | 4 MB | SST file size |
| OverflowPrefix | `trieHistSpace` | Compaction hint (when pruning enabled) |

Configured via `--cache` flag (default 4096 MB total).

## LogDB — Event and Transfer Logs (SQLite)

SQLite database (`mattn/go-sqlite3`) with WAL journal mode.

### Schema

**ref table** — blob deduplication for blockID, txID, addresses, topics:

```sql
CREATE TABLE ref (id INTEGER PRIMARY KEY, data BLOB NOT NULL UNIQUE);
```

**event table:**

```sql
CREATE TABLE event (
  seq INTEGER PRIMARY KEY,
  blockID, blockTime, txID, txOrigin, clauseIndex,
  address, topic0, topic1, topic2, topic3, topic4,
  data BLOB
);
```

Indexes on address, topic combinations (6 indexes total, one optional via `--logdb-additional-indexes`).

**transfer table:**

```sql
CREATE TABLE transfer (
  seq INTEGER PRIMARY KEY,
  blockID, blockTime, txID, txOrigin, clauseIndex,
  sender, recipient, amount BLOB(32)
);
```

Indexes on txOrigin, sender, recipient.

### Query API

- `FilterEvents(ctx, *EventFilter)` — range (block from/to), criteria (address, topics), order, limit
- `FilterTransfers(ctx, *TransferFilter)` — same pattern

`seq` encodes block number + tx index + log index for ordering.

Journal size limit: 50 MB. Separate read-only and write connections.

## Merkle-Patricia Trie

Located in `trie/`. Versioned Merkle-Patricia trie for state management.

### Node Types

| Type | Description |
|------|-------------|
| `fullNode` | 17 children (16 hex nibbles + value) |
| `shortNode` | Compressed path key + single child |
| `refNode` | Hash + version (database reference) |
| `valueNode` | Leaf value + metadata |

### Version

`Version{Major, Minor uint32}` — major is block number, minor is sub-index within block.

### Read Path

cache → hist space → deduped space (with fallback handling for account/index roots).

### Write Path

`Commit()` writes to hist space, optionally populates cache. `Checkpoint()` copies nodes from hist to deduped space for a version range.

Empty root: `thor.Blake2b(rlp.EmptyString)`.

## State Management

Located in `state/`. Connects tries to the EVM execution layer.

```
revert-able state → stacked map → journal → playback → updated trie
       → trie cache → read-only trie
```

**State** struct holds:
- Account trie (`"a"`)
- Per-address cached objects (account data, code, storage trie, storage map)
- `StackedMap` for revertable changes (EVM snapshots)

**Stage/Commit**: `Stage(newVersion)` computes state root, returns `Stage` with `commit()` that writes code and commits all tries.

## Pruning

Located in `cmd/thor/pruner/`. Removes historical trie nodes to reclaim disk space.

### How It Works

1. Runs periodically: every 65536 blocks (or 8192 when nearly synced)
2. **Checkpoint**: copies trie nodes from hist → deduped space for `[base, target)` range
3. **Delete**: removes hist nodes in that range via `DeleteTrieHistoryNodes()`
4. Preserves `MaxStateHistory` (65535 blocks) of recent history for EVM access

### Configuration

| Flag | Effect |
|------|--------|
| `--disable-pruner` | Stops pruner, keeps all history (archive mode) |

When disabled: `TrieHistPartitionFactor` = 524288 (vs 256 for pruning), instance dir gets `-full` suffix.

### Partition Factors

| Setting | Pruning | Archive |
|---------|---------|---------|
| `TrieHistPartitionFactor` | 256 | 524288 |
| `TrieDedupedPartitionFactor` | MaxUint32 | MaxUint32 |
| `TrieCachedNodeTTL` | 30 | 30 |

## Node Types vs Storage

| Type | Flags | Disk Size | Notes |
|------|-------|-----------|-------|
| **Full** | (default) | ~200 GB | Pruned trie history + logs |
| **Full without logs** | `--skip-logs` | ~100 GB | No event/transfer logs, `/logs` API disabled |
| **Archive** | `--disable-pruner` | >400 GB | All trie history preserved |

Instance directory naming: `instance-<genesisID[24:]>-<version>[-full]`.

## Cache Layer

| Cache | Implementation | Size | Purpose |
|-------|---------------|------|---------|
| Trie node cache | `directcache` | 1/4 queried + 3/4 committed | Hot trie nodes |
| Root cache | Map + TTL eviction | — | Trie roots |
| Chain summaries | ARC | 512 | Block summaries |
| Chain txs | ARC | 2048 | Transactions |
| Chain receipts | ARC | 2048 | Receipts |
| Code cache | ARC | 512 | Contract bytecode |
| Future blocks | `RandCache` | 32 | Blocks ahead of head |
| Base fee | Custom | — | Cached base fee calculations |
| LevelDB | Block cache + write buffer | Configurable | Engine-level I/O cache |

## Component Wiring

```
main.go
  → openMainDB() → muxdb.Open(path, opts) → LevelDB engine
  → openLogDB() → logdb.New(path) → SQLite
  → chain.NewRepository(mainDB, genesis) → named KV stores for headers/bodies/txindex
  → state.NewStater(mainDB) → account trie + storage tries
  → pruner.New(mainDB, repo, bftEngine) // unless --disable-pruner
```
