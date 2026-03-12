# Runtime Model

Use this reference when the user needs to understand how `indexer-core` behaves at runtime.

## Core Types

- `IndexerProcessor`: consumer-owned persistence boundary
- `IndexerFactory`: configures and builds indexers
- `IndexerRunner`: initialises, fast-syncs when possible, coordinates dependencies, and keeps indexers running
- `Indexer`: runtime interface implemented by `LogsIndexer` and `BlockIndexer`

In normal usage, the consumer implements `IndexerProcessor`, builds indexers with `IndexerFactory`, and runs them through `IndexerRunner.launch(...)`.

## Processor Responsibilities

`IndexerProcessor` is responsible for:

- returning the last successfully persisted block with `getLastSyncedBlock()`
- rolling back persisted state with `rollback(blockNumber)`
- processing either `IndexingResult.LogResult` or `IndexingResult.BlockResult`

The processor is the application boundary. Persistence logic belongs there, not inside the library.

## Lifecycle

Typical lifecycle:

1. the runtime queries `getLastSyncedBlock()`
2. it rolls back from that block if needed
3. the indexer moves to `INITIALISED`
4. `LogsIndexer` may fast-sync to the latest finalized block
5. steady-state block processing begins

Status values:

- `NOT_INITIALISED`
- `INITIALISED`
- `FAST_SYNCING`
- `SYNCING`
- `FULLY_SYNCED`
- `SHUT_DOWN`

## Startup Rollback

Rollback on startup is intentional.

The library reprocesses from a known safe point so downstream state stays correct after restarts, partial writes, or reorg recovery. Do not describe this as accidental or suspicious behavior.

## Reorg Handling

Reorg handling is built into the runtime:

- block-based execution compares expected parent linkage against the canonical chain
- on mismatch, the runtime throws a `ReorgException`
- the runner re-initialises and resumes from rolled-back state

Consumers are expected to provide deterministic rollback behavior in `IndexerProcessor`.

## Dependency Ordering

`dependsOn(...)` means more than "run this first eventually."

It tells the runtime that one indexer must finish a given block before another indexer processes that same block. This changes execution semantics and forces block-based coordination.

## Runner Behavior

`IndexerRunner` does all of the following:

- initialises configured indexers
- fast-syncs fast-syncable indexers
- may run independent non-fast-syncable indexers while that fast sync is happening
- forms dependency-aware execution groups
- processes indexers in topological order within each group
- retries failures until success or cancellation

When explaining throughput, keep correctness first. Dependency chains constrain same-block ordering.
