# Thor Node Architecture

Module path: `github.com/vechain/thor/v2`

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Language | Go (1.25+) |
| State DB | LevelDB via `muxdb` (multiplexed) |
| Log DB | SQLite (`logdb`) |
| EVM | Fork of go-ethereum, Shanghai hardfork compatible |
| Trie | Modified Merkle Patricia Trie with versioned nodes |
| P2P | devp2p (Ethereum-derived), RLPx |
| Hashing | Blake2b (not Keccak for most chain ops) |
| VRF | ECVRF-SECP256K1-SHA256-TAI |
| CLI | `urfave/cli/v3` |

## Package Map

| Package | Purpose |
|---------|---------|
| `cmd/thor` | CLI entry point — `main.go` (network node), `solo` subcommand, `master-key`, `reprocess` |
| `thor` | Core types (`Address`, `Bytes32`), constants, fork config, governance param keys |
| `block` | Block header/body structures, signature handling, VRF alpha/beta fields |
| `tx` | Transaction types (legacy + typed after Galactica), multi-clause model, fee delegation |
| `state` | State trie access — account balances, storage, code; `Stater` creates state snapshots from root |
| `muxdb` | Multiplexed DB layer over LevelDB — main state storage with optional metrics |
| `logdb` | SQLite-based event/transfer log storage (skippable via `--skip-logs`) |
| `chain` | Chain repository — block summaries, chain forks, tx lookups, chain tag |
| `consensus` | Block validation — header checks, proposer validation (PoA or PoS), tx execution, state root verification |
| `bft` | BFT finality engine — vote tracking, epoch quality, justified/finalized checkpoints |
| `scheduler` | Block proposer scheduling — `PoASchedulerV1`, `PoASchedulerV2`, `PoSScheduler` |
| `vrf` | Verifiable Random Function — seed generation for proposer shuffling (post-VIP-214) |
| `packer` | Block construction — assembles blocks with transactions for proposers |
| `runtime` | EVM execution environment — runs transactions, handles built-in contract calls |
| `builtin` | Built-in contracts: Authority, Energy, Params, Prototype, Extension, Executor, Staker, Measure |
| `txpool` | Transaction pool management with per-account limits and lifetime expiry |
| `api` | RESTful API server (OpenAPI spec in `api/doc/thor.yaml`) |
| `p2p` / `p2psrv` | P2P networking layer |
| `comm` | P2P communication — block/tx propagation between peers |
| `genesis` | Genesis block generation for mainnet, testnet, devnet |
| `vm` | Modified EVM (forked from go-ethereum) |
| `tracers` | Transaction tracers — JS, native, and logger tracers (forked from geth) |
| `trie` | Versioned Merkle Patricia Trie implementation |
| `kv` | Key-value store abstraction |
| `xenv` | Execution environment for built-in contract native calls |
| `metrics` | Prometheus metrics collection |
| `cache` | LRU and priority caches |
| `stackedmap` | Copy-on-write map used in state management |

## Data Flow: Block Sync & Validation

```
P2P peers → comm (download blocks)
  → consensus.Process()
    → validateBlockHeader (timestamp, gas, score, VRF alpha/beta, baseFee)
    → staker.SyncPOS() (check if PoS transition happened)
    → validateAuthorityProposer OR validateStakingProposer
      → scheduler picks correct Scheduler impl
      → verify signer is scheduled for this timeslot
      → verify score matches
    → validateBlockBody (tx roots, chain tag, expiry, blocklist)
    → verifyBlock (execute all txs, compare state root, receipts root)
    → if PoS active: distribute rewards via Energy.DistributeRewards
  → bft.CommitBlock (track votes, update quality, finalize checkpoints)
  → chain.Repository saves block
  → logdb records events/transfers (unless --skip-logs)
  → pruner trims old state (unless --disable-pruner)
```

## Package Dependencies (Simplified)

```
cmd/thor
  ├── consensus (uses: chain, state, scheduler, builtin, runtime, block, tx)
  ├── bft       (uses: chain, state, builtin, block)
  ├── packer    (uses: chain, state, builtin, runtime, txpool)
  ├── txpool    (uses: chain, state, tx)
  ├── api       (uses: chain, state, logdb, txpool, bft)
  ├── comm      (uses: chain, txpool, p2p)
  ├── logdb     (standalone SQLite)
  └── muxdb     (standalone LevelDB)

builtin → state, thor, xenv, abi
  ├── authority, energy, params, prototype (state-backed linked lists / storage)
  └── staker (validation, delegation, aggregation, globalstats sub-packages)

consensus → scheduler → thor (for constants, Blake2b)
bft → chain, builtin.Staker (for PoS weight queries)
```

## Node Types

| Type | Flags | Storage | Notes |
|------|-------|---------|-------|
| **Full node** | `--network mainnet` | ~200 GB (Apr 2024), 1 TB SSD recommended | Logs + pruner enabled |
| **Full without logs** | `--skip-logs` | ~100 GB | Recommended for validators; `/logs` API disabled |
| **Archive node** | `--disable-pruner` | 400+ GB | Full state history preserved |
| **Validator** | `--skip-logs` + master key | ~100 GB, 500 GB NVMe SSD | Must be voted in via Authority contract, needs endorsement |
| **Solo** | `thor solo` | In-memory (or `--persist`) | Local dev/test; single node, no P2P; `--on-demand` for tx-triggered blocks |

## Key Configuration

### CLI Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--network` | — | `mainnet`/`testnet` or path/URL to genesis file |
| `--api-addr` | `localhost:8669` | REST API listen address |
| `--p2p-port` | `11235` | P2P network port |
| `--max-peers` | `25` | Max P2P peers (0 disables P2P) |
| `--skip-logs` | false | Skip event/transfer log writes |
| `--disable-pruner` | false | Keep all state history (archive mode) |
| `--cache` | `4096` | MB of RAM for trie node cache |
| `--beneficiary` | — | Address for block rewards |
| `--target-gas-limit` | `0` (adaptive) | Target block gas limit |
| `--enable-metrics` | false | Prometheus metrics |
| `--metrics-addr` | `localhost:2112` | Metrics endpoint |
| `--enable-admin` | false | Admin server |
| `--admin-addr` | `localhost:2113` | Admin endpoint |
| `--min-effective-priority-fee` | `0` | Min priority fee for packing txs |

All flags support `THOR_` prefixed env vars (e.g., `THOR_NETWORK`, `THOR_API_ADDR`).

### Ports

| Port | Protocol | Purpose |
|------|----------|---------|
| 8669 | TCP (HTTP) | REST API |
| 11235 | TCP + UDP | P2P network |
| 2112 | TCP (HTTP) | Prometheus metrics (opt-in) |
| 2113 | TCP (HTTP) | Admin server (opt-in) |

### Fork Config

Fork activation is defined per-network by genesis block ID in `thor/fork_config.go`. Each fork activates at a specific block number.

| Fork | Mainnet Block | What Changed |
|------|--------------|-------------|
| `VIP191` | 3,337,300 | Fee delegation (tx feature flag) |
| `ETH_CONST` | 3,337,300 | Ethereum-compatible constants |
| `BLOCKLIST` | 4,817,300 | Origin/delegator address blocklist |
| `ETH_IST` | 9,254,300 | Ethereum Istanbul EVM changes |
| `VIP214` | 10,653,500 | PoA2 — VRF-based proposer shuffling, complex block signatures |
| `FINALITY` | 13,815,000 | BFT finality engine — justified/finalized checkpoints |
| `GALACTICA` | 22,084,200 | EIP-1559 base fee, typed transactions, staker contract |
| `HAYABUSA` | 23,414,400 | PoA-to-PoS transition period begins; weight-based BFT |

### Block Constants

| Parameter | Value |
|-----------|-------|
| Block interval | 10 seconds |
| Initial gas limit | 10,000,000 |
| Min gas limit | 1,000,000 |
| Tx base gas | 5,000 |
| Clause gas | 16,000 |
| Max state history | 65,535 blocks |
| Epoch length | Used for BFT rounds |
| Max block proposers | 101 (initial) |
| Energy growth rate | ~0.000432 VTHO/VET/day |
