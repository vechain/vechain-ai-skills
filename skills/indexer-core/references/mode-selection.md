# Mode Selection

Use this reference when the user needs help choosing or debugging indexer mode.

## Core Rule

`LogsIndexer` and `BlockIndexer` are not interchangeable. Choose based on data and execution requirements, not just speed.

## Choose `LogsIndexer` When

Use the default factory-built log mode when the consumer:

- only needs decoded ABI events, business events, or VET transfers
- wants the fastest catch-up path
- does not need full `Block` contents
- does not require same-block dependency ordering with another indexer

`LogsIndexer` fast-syncs by querying Thor log endpoints over block ranges and emitting `IndexingResult.LogResult`.

## Choose `BlockIndexer` When

Use block mode when the consumer needs:

- full block contents
- reverted transaction visibility
- gas or fee metadata that comes from full block processing
- clause inspection via `callDataClauses(...)`
- same-block dependency ordering through `dependsOn(...)`

Block mode emits `IndexingResult.BlockResult`.

## Factory Triggers

`IndexerFactory.build()` returns block-based execution semantics when either of these is set:

- `includeFullBlock()`
- `dependsOn(...)`

Otherwise it defaults to log-based execution.

## Dependency Implications

If one indexer must finish block `N` before another handles block `N`, use `dependsOn(...)`.

That is not a minor optimization hint. It changes how the runner coordinates execution and requires block-based processing.

## Common Mistakes To Avoid

- saying `LogsIndexer` and `BlockIndexer` only differ in performance
- recommending `includeFullBlock()` without a concrete need for full block data
- adding `dependsOn(...)` casually when the user only needs eventual consistency
- forgetting that processors may need to handle different `IndexingResult` shapes depending on configuration
