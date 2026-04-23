---
name: thor
description: VeChainThor node internals — architecture, consensus (PoA/PoS/BFT), built-in contracts, REST API, storage, P2P networking, block production, transaction lifecycle, reward distribution, staking, and contributing to the Go codebase.
allowed-tools: []
license: MIT
metadata:
  author: VeChain
  version: "0.1.0"
---

# Thor Skill

## CRITICAL RULES

1. **Read reference files FIRST.** When the user's request involves any topic in the reference table below, read those files before doing anything else. Briefly mention which files you are reading so the user can confirm the skill is active.
2. **Information priority:** (a) Reference files in this skill — always the primary source. (b) The thor repo source code at `github.com/vechain/thor/v2` for implementation details. (c) Web search — only as a last resort for topics NOT covered in references.
3. **Prefer working directly in the main conversation.** Plan mode and subagents do not inherit skill context and may produce stale answers.
4. **After compaction or context loss**, re-read this SKILL.md to restore awareness of the reference table.

## Scope

Use this Skill for anything related to the VeChainThor node (thor):

- Architecture and package structure of the Go codebase
- Consensus: PoA v1/v2, PoS (Galactica), BFT finality
- Built-in contracts: Authority, Energy, Staker, Params, Prototype, Executor, Extension
- REST API endpoints and WebSocket subscriptions
- Storage: LevelDB, SQLite logdb, trie, pruning, node types
- P2P networking: discovery, block/tx propagation
- Cross-cutting flows: block production, transaction lifecycle, reward distribution, staking/delegation, chain sync
- Solo mode for local development
- Contributing to the thor codebase: build, test, add endpoints, fork config

For application-level VeChain development, see the companion skills:

- **vechain-core** — SDK usage, fee delegation, multi-clause transactions, dual-token model
- **vechain-kit** — VeChain Kit hooks, components, wallet connection, social login
- **smart-contract-development** — Solidity, Hardhat, testing, security
- **stargate** — NFT staking, validator delegation, VTHO rewards

## Operating procedure

### 1. Identify the question type

- **PM/architecture question** → read `architecture.md` + relevant flow files
- **Contributor question** → read `contributing.md` + relevant package reference
- **"How does X work?"** → read the matching flow file(s)
- **API question** → read `api.md`
- **Node operations** → read `architecture.md` (node types, flags, ports)

### 2. Read before answering

Load the matching reference files from the table below. Cross-cutting questions may need multiple files.

### 3. Answer with context

- Reference specific packages, types, and files from the thor codebase
- For flows, trace through the packages step-by-step
- For PM audiences, lead with the high-level summary before diving into implementation
- For contributors, include package paths and key type names

## Reference files

Read the matching files BEFORE doing anything else. See Critical Rules above.

| Topic | File | Read when user mentions... |
|-------|------|---------------------------|
| Architecture | [references/architecture.md](references/architecture.md) | overview, packages, node types, ports, flags, fork config, tech stack |
| Consensus | [references/consensus.md](references/consensus.md) | PoA, PoS, BFT, finality, proposer, validator selection, VRF, Galactica |
| Built-in contracts | [references/built-in-contracts.md](references/built-in-contracts.md) | Authority, Energy, VTHO, Staker, Params, Prototype, Executor, native contracts |
| REST API | [references/api.md](references/api.md) | API, endpoints, routes, subscriptions, WebSocket, Swagger |
| Storage | [references/storage.md](references/storage.md) | database, LevelDB, SQLite, logdb, trie, pruning, archive, disk |
| P2P networking | [references/p2p.md](references/p2p.md) | peers, discovery, discv5, propagation, sync protocol, bootstrap |
| Contributing | [references/contributing.md](references/contributing.md) | build, Makefile, tests, lint, add endpoint, fork config, PR, Go conventions |
| Solo mode | [references/solo.md](references/solo.md) | solo, local dev, test chain, pre-funded accounts, auto-mine |
| Flow: block production | [references/flow-block-production.md](references/flow-block-production.md) | block packing, scheduler, proposer, how blocks are created |
| Flow: transaction lifecycle | [references/flow-transaction-lifecycle.md](references/flow-transaction-lifecycle.md) | tx flow, txpool, clause execution, receipts, tx validation |
| Flow: reward distribution | [references/flow-reward-distribution.md](references/flow-reward-distribution.md) | rewards, VTHO generation, validator rewards, gas rewards, burning |
| Flow: staking & delegation | [references/flow-staking-delegation.md](references/flow-staking-delegation.md) | staking, delegation, unstaking, Staker contract, validator lifecycle |
| Flow: chain sync | [references/flow-sync.md](references/flow-sync.md) | sync, catch-up, peer download, fork handling, reorg, propagation |
