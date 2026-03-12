# Maintenance And Migration

Use this reference when changing the library or helping users migrate.

## Source Of Truth

When working in the `indexer-core` repository:

1. read `README.md`
2. read `docs/README.md`
3. read the task-specific guide in `docs/`

Treat the repo markdown docs as the authoritative public contract.

## Verification Expectations

For code changes:

- run targeted tests for the touched behavior
- run `./gradlew test` when the change is cross-cutting
- run `./gradlew spotlessCheck` or `./gradlew spotlessApply` when Kotlin code changed

Be explicit if full verification was not run.

## Agent Guidance For The Repo

If the repository contains an `AGENTS.md`, align with it before making behavioral claims. That file should be treated as the repository's canonical agent briefing.

## 8.0.0 Migration Points

The main 7.x to 8.x changes called out by the repo docs are:

- `IndexingResult.Normal` was renamed to `IndexingResult.BlockResult`
- `IndexingResult.EventsOnly` was renamed to `IndexingResult.LogResult`
- pruner functionality was removed

When helping users migrate, focus on:

- updating `when` branches and type checks
- removing pruner-related configuration and code
- verifying status handling against the current enum values

## Maintenance Guardrails

- preserve rollback and reorg semantics unless the task explicitly changes them
- do not present internal implementation details as stable public API unless the docs support that
- update public docs when behavior or usage guidance changes
