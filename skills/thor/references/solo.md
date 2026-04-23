# Solo Mode

Solo mode runs a local single-node VeChain chain for development and testing.
No P2P networking, no real consensus — just a local sandbox with pre-funded accounts.

## Starting Solo

```bash
thor solo [flags]
```

### Solo-Specific Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--on-demand` | false | Create blocks only when pending transactions exist |
| `--block-interval` | 10 | Block interval in seconds |
| `--persist` | false | Persist data to disk (otherwise in-memory) |
| `--gas-limit` | 40,000,000 | Block gas limit (0 = adaptive) |
| `--genesis` | — | Custom genesis file path/URL (default: builtin devnet) |
| `--txpool-limit` | 10,000 | Transaction pool size |

### Common Examples

```bash
thor solo                                    # basic, in-memory, 10s blocks
thor solo --on-demand                        # blocks only when txs arrive
thor solo --persist --on-demand              # persistent + on-demand
thor solo --api-addr 0.0.0.0:8669            # expose API externally
thor solo --gas-limit 0 --api-cors="*"       # adaptive gas, open CORS
```

## Mining Modes

### Auto-Mining (Default)

- Loop runs every second
- Produces a block when `time.Now().Unix() % blockInterval == 0`
- Creates empty blocks if no transactions

### On-Demand (`--on-demand`)

- Uses `OnDemandTxPool` instead of the standard tx pool
- Block produced immediately when an executable transaction is submitted
- Empty blocks are skipped
- Can produce blocks with future timestamps if needed

## Pre-Funded Accounts

10 accounts, each with **1,000,000,000 VET** (1e27 wei) in both balance and energy.

Generated from fixed private keys in `genesis/devnet.go`:

| # | Private Key |
|---|-------------|
| 0 | `99f0500549792796c14fed62011a51081dc5b5e68fe8bd8a13b86be829c4fd36` |
| 1 | `7b067f53d350f1cf20ec13df416b7b73e88a1dc7331bc904b92108b1e76a08b1` |
| 2 | `f4a1a17039216f535d42ec23732c79943ffb45a089fbb78a14daad0dae93e991` |
| 3 | `35b5cc144faca7d7f220fca7ad3420090861d5231d80eb23e1013426847371c4` |
| 4 | `10c851d8d6c6ed9e6f625742063f292f4cf57c2dbeea8099fa3aca53ef90aef1` |
| 5 | `2dd2c5b5d65913214783a6bd5679d8c6ef29ca9f2e2eae98b4add061d0b85ea0` |
| 6 | `e1b72a1761ae189c10ec3783dd124b902ffd8c6b93cd9ff443d5490ce70047ff` |
| 7 | `35cbc5ac0c3a2de0eb4f230ced958fd6a6c19ed36b5d2b1803a9f11978f96072` |
| 8 | `b639c258292096306d2f60bc1a8da9bc434ad37f15cd44ee9a2526685f592220` |
| 9 | `9d68178cdc934178cca0a0051f40ed46be153cf23cb1805b59cc612c0ad2bbe0` |

Account #0 (`0xf077b491b355E64048cE21E3A6Fc4751eEeA77fa`) also serves as the executor and block signer (PoA validator).

## Persistence

| Mode | Storage | Behavior |
|------|---------|----------|
| Default (no `--persist`) | In-memory | Data lost on restart |
| `--persist` | Disk | Written to `--data-dir`, survives restarts |

With `--persist`, instance directory follows the standard naming: `instance-<genesisID[24:]>-<version>`.

## API Access

Same HTTP API as a full node, default `localhost:8669`. Differences in solo:

- **Debug API**: PoA checks skipped during trace replay (`skipPoA: true`)
- **Admin health**: always reports healthy (peer count check bypassed)
- **No P2P**: `solo.Communicator{}` is a no-op stub

All standard flags work: `--api-addr`, `--api-cors`, `--api-timeout`, `--api-pprof`, etc.

## Genesis Configuration

Default solo genesis is the **devnet** config (`genesis/devnet.go`):

- Genesis ID: `0x00000000bb55405beed90df9fea5acdb1cb7caba61b0d7513395f42efd30e558`
- All forks enabled from block 0 (`SoloFork`)
- Initial gas limit: 10,000,000 (overridable via `--gas-limit`)

```go
SoloFork = ForkConfig{
    VIP191: 0, ETH_CONST: 0, BLOCKLIST: 0, ETH_IST: 0,
    VIP214: 0, FINALITY: 0, GALACTICA: 0, HAYABUSA: 0,
}
```

Custom genesis can be provided via `--genesis <path-or-url>`.

## Solo vs Testnet/Mainnet

| Aspect | Solo | Testnet/Mainnet |
|--------|------|-----------------|
| P2P networking | None | Full discv5 + RLPx |
| Consensus | Mocked BFT engine | Real BFT with PoA/PoS |
| Genesis | Devnet (all forks at block 0) | Network-specific fork schedule |
| Block production | Local packer (auto or on-demand) | Committee-based |
| Master key | Not required | Required for block signing |
| Persistence | Optional (in-memory default) | Always on disk |
| Pre-funded accounts | 10 × 1B VET | None |

## Use Cases

- **Smart contract development**: deploy and test contracts with instant feedback
- **dApp development**: full API available locally, no sync delay
- **Integration testing**: deterministic blocks, predictable behavior
- **CI pipelines**: lightweight, fast startup, no external dependencies
- **On-demand mode**: block only when you transact, ideal for scripted tests

## Key Source Files

| File | Purpose |
|------|---------|
| `cmd/thor/solo/solo.go` | Solo entry point and main loop |
| `cmd/thor/solo/core.go` | Block packing logic |
| `cmd/thor/solo/txpool.go` | On-demand transaction pool |
| `cmd/thor/solo/types.go` | Solo communicator stub |
| `genesis/devnet.go` | Devnet genesis, DevAccounts, SoloConfig |
| `thor/fork_config.go` | SoloFork definition |
| `bft/engine.go` | soloMockedEngine |
