# Contributing to Thor

## Prerequisites

- **Go 1.25+** (enforced by Makefile version check)
- `golangci-lint` — install from <https://golangci-lint.run/usage/install/>
- **Docker** — needed for Solidity compilation (`builtin/gen`) and license checks
- **GPG key** — all commits must be GPG-signed

## Build System

| Target | Description |
|---|---|
| `make` / `make thor` | Build `bin/thor` (blockchain node) |
| `make disco` | Build `bin/disco` (discovery bootnode) |
| `make all` | Build both binaries |
| `make test` | Run unit tests with coverage |
| `make fuzz` | Fuzz test tx/block encoding (default 1 min per target) |
| `make test-coverage` | Tests with race detector + HTML coverage report |
| `make lint` | Run `golangci-lint` + `gopls/modernize` |
| `make lint-fix` | Auto-fix lint issues + regenerate builtins |
| `make generate` | Regenerate `builtin` package from Solidity sources |
| `make license-check` | Check license headers via Docker (Apache SkyWalking Eyes) |
| `make install-hooks` | Install pre-commit hook (private key detection) |
| `make clean` | Remove binaries and purge build/test caches |

Binaries are output to `bin/`.

Version strings are injected via `-ldflags` from `cmd/thor/VERSION` (currently `2.4.2`) and `cmd/disco/VERSION`.

## Running the Node Locally

```bash
make thor
bin/thor --network main    # mainnet
bin/thor --network test    # testnet
bin/thor solo              # solo (dev) mode — instant blocks, all forks enabled at genesis
```

Solo mode activates all forks at block 0 (`SoloFork` in `thor/fork_config.go`), making it ideal for local development.

## Directory Organization

```
cmd/
  thor/         Main node binary (flags, solo mode, pruner, sync, p2p)
  disco/        Bootnode discovery tool
api/            REST API layer (gorilla/mux)
  accounts/     Account/contract endpoints
  blocks/       Block query endpoints
  transactions/ Tx submission/query
  events/       Event log filtering
  transfers/    Transfer log filtering
  subscriptions/ WebSocket subscriptions
  debug/        Debug/tracer endpoints
  admin/        Admin endpoints
  fees/         Fee delegation endpoints
  node/         Node info endpoints
  middleware/   HTTP middleware (metrics, logging)
  restutil/     Shared REST utilities
  doc/          OpenAPI spec
thor/           Core types (Address, Bytes32, ForkConfig)
tx/             Transaction model
block/          Block model
chain/          Chain repository (block storage, indexing)
state/          State trie access
runtime/        EVM execution runtime
vm/             EVM implementation (go-ethereum fork)
consensus/      Block validation / consensus rules
packer/         Block packing / proposal
scheduler/      Block scheduling
bft/            Byzantine fault tolerance (finality)
builtin/        Built-in smart contracts (native bindings)
  gen/          Solidity sources + code generation
genesis/        Genesis block construction
logdb/          Event/transfer log database
muxdb/          Multiplexed database layer
trie/           Merkle Patricia trie
txpool/         Transaction pool
p2p/            Low-level P2P networking
p2psrv/         P2P server
comm/           P2P communication protocol
tracers/        EVM tracing (js, logger, native)
thorclient/     Go client library for thor API
metrics/        Prometheus metrics
test/           Test utilities
  testchain/    In-memory chain for testing
  testnode/     In-memory node for API testing
  datagen/      Test data generators
  bindcontract/ Contract binding helpers
  eventcontract/ Test event contract
```

## Testing

Tests use standard `go test` and `github.com/stretchr/testify`.

### Test utilities (`test/`)

| Package | Purpose |
|---|---|
| `testchain` | Spins up an in-memory chain with genesis, BFT engine, and block production helpers |
| `testnode` | Builds a full in-memory node with REST API for integration tests |
| `datagen` | Generates random addresses, hashes, bytes, and numbers for tests |
| `bindcontract` | Helpers for deploying and binding test contracts |
| `eventcontract` | Pre-built contract for event emission tests |

`testchain.Chain` provides `MintBlock()` / `MintTransactions()` to produce blocks programmatically without P2P.

### Fuzz targets

Located in `tx/` and `block/` packages — test marshalling/unmarshalling roundtrips.

## Code Style & Linting

### Formatting

Enforced via `golangci-lint` formatters (`.golangci.yml`):

- `gofmt` (with simplify)
- `goimports` (local prefix: `github.com/vechain/thor`)
- `gofumpt`
- `golines` (max line length: 160)

### Linters enabled

`bidichk`, `copyloopvar`, `durationcheck`, `gosec`, `govet`, `ineffassign`, `misspell`, `revive`, `staticcheck`, `unconvert`, `unused`, `whitespace`

Paths excluded from linting: `third_party`, `builtin`, `examples`, `p2p/*`.

### Pre-commit hook

`make install-hooks` installs a hook that scans for 64-char hex strings (potential private keys) in staged changes. Bypass with `SAFE_TO_IGNORE_KEY=1`.

## CI Pipeline (Pull Requests)

PRs trigger these checks (`.github/workflows/on-pull-request.yaml`):

1. **Unit tests** — `make test` with codecov upload
2. **License check** — Apache SkyWalking Eyes header scan
3. **Lint** — `golangci-lint` via `lint-go.yaml`
4. **Go module check** — verifies `go.mod` / `go.sum` consistency
5. **Workflow scan** — security scan of GitHub Actions workflows
6. **Docker test suite** — integration tests via Docker
7. **Rosetta tests** — Coinbase Rosetta API compliance

## Adding a REST API Endpoint

Each API domain follows the same pattern in `api/`:

1. **Create a package** under `api/<domain>/` (e.g., `api/fees/`)
2. **Define the handler struct** with dependencies (repo, stater, etc.):

   ```go
   type Fees struct {
       repo   *chain.Repository
       stater *state.Stater
   }
   func New(repo *chain.Repository, stater *state.Stater) *Fees { ... }
   ```

3. **Implement handler methods** returning `func(w http.ResponseWriter, req *http.Request) error`:

   ```go
   func (f *Fees) handleGetFee(w http.ResponseWriter, req *http.Request) error { ... }
   ```

4. **Add a `Mount` method** to register routes on a `mux.Router`:

   ```go
   func (f *Fees) Mount(root *mux.Router, pathPrefix string) {
       sub := root.PathPrefix(pathPrefix).Subrouter()
       sub.Path("/{id}").Methods(http.MethodGet).
           Name("GET /fees/{id}").
           HandlerFunc(restutil.WrapHandlerFunc(f.handleGetFee))
   }
   ```

5. **Define request/response types** in `api/<domain>_types.go` (at the `api/` package level)
6. **Wire it up** in the main API router by calling `Mount()`

Key conventions:

- Use `restutil.WrapHandlerFunc` to wrap handlers (handles error responses)
- Parse path params with `mux.Vars(req)`
- Parse query params / block revision via shared utilities in `api/restutil/`

## Fork Configuration

Forks are defined in `thor/fork_config.go` as the `ForkConfig` struct:

```go
type ForkConfig struct {
    VIP191    uint32
    ETH_CONST uint32
    BLOCKLIST uint32
    ETH_IST   uint32
    VIP214    uint32
    FINALITY  uint32
    HAYABUSA  uint32
    GALACTICA uint32
}
```

Each field is a **block number** at which the fork activates. `math.MaxUint32` means disabled.

To add a new fork:

1. Add a new field to `ForkConfig`
2. Set it to `math.MaxUint32` in `NoFork`
3. Set it to `0` in `SoloFork` (enables immediately in dev mode)
4. Add activation block numbers in the `forkConfigs` map for mainnet/testnet genesis IDs
5. Update `String()` to include the new fork name
6. Reference `forkConfig.YourFork` in consensus/runtime code to gate new behavior

Fork names follow VIP numbers (e.g., `VIP191`, `VIP214`) or codenames (e.g., `HAYABUSA`, `GALACTICA`).

## Built-in Contracts

Built-in (native) contracts live in `builtin/`:

| Contract | File | Purpose |
|---|---|---|
| Authority | `authority_native.go` | Authority/validator management |
| Energy (VTHO) | `energy_native.go` | VTHO token operations |
| Params | `params_native.go` | On-chain governance parameters |
| Prototype | `prototype_native.go` | Account metadata/master |
| Extension | `extension_native.go` | Block/tx introspection helpers |
| Executor | (via Solidity) | On-chain governance execution |
| Staker | `staker_native.go` | PoS staking (Hayabusa+) |

### Modifying built-in contracts

1. Edit Solidity source in `builtin/gen/*.sol`
2. Compile: `docker run --rm -v ./builtin/gen:/solidity ghcr.io/argotorg/solc:0.4.24 ...` (see `gen.go` for exact flags — solc 0.4.24 for legacy contracts, solc 0.8.20 for staker)
3. Regenerate Go bindings: `make generate` (runs `go generate builtin/gen/gen.go`)
4. Implement native call handlers in `builtin/*_native.go`
5. Wire into `builtin/builtin.go` and `builtin/contract.go`

Compiled ABI/bytecode lives in `builtin/gen/compiled/` (embedded via `//go:embed`).

## Replaced Dependencies

Two critical `replace` directives in `go.mod`:

| Original | Fork | Why |
|---|---|---|
| `github.com/ethereum/go-ethereum` | `github.com/vechain/go-ethereum` | Customized EVM, crypto, RLP — diverged significantly from upstream |
| `github.com/syndtr/goleveldb` | `github.com/vechain/goleveldb` | Custom patches for VeChain's storage layer |

When importing `go-ethereum` packages, the actual code comes from the VeChain fork. This affects `vm/`, `abi/`, `crypto/`, `rlp/`, `trie/` and related packages.

## PR Requirements

1. Fork repo → create feature branch (`feature/your-feature-name`)
2. Keep branch up-to-date with `master`
3. Run `make test` and `make lint` before pushing
4. **All commits must be GPG-signed**
5. PR targets `master` branch
6. PR description must clearly explain changes and rationale
7. Follow [Effective Go](https://golang.org/doc/effective_go) guidelines
8. VIPs (protocol changes) require a separate proposal at [vechain/VIPs](https://github.com/vechain/VIPs) first
