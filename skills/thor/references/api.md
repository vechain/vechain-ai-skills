# REST API

Thor exposes an HTTP API (default `localhost:8669`) plus a separate admin server (`localhost:2113`).
Uses **gorilla/mux** router. WebSocket endpoints for real-time subscriptions.

## Route Organization

```
api/
├── accounts/       # Account state, code, storage, contract calls
├── blocks/         # Block retrieval
├── transactions/   # Submit and fetch transactions
├── events/         # Event log queries (POST /logs/event)
├── transfers/      # Transfer log queries (POST /logs/transfer)
├── fees/           # Fee history and priority
├── node/           # Peers, txpool
├── debug/          # EVM tracers, storage range
├── subscriptions/  # WebSocket subscriptions
├── doc/            # OpenAPI spec, Swagger/Stoplight UI
├── middleware/     # CORS, metrics, logging, panic recovery
├── restutil/       # Shared HTTP helpers
└── admin/          # Separate admin server (health, loglevel, apilogs)
```

## Endpoint Groups

### Accounts — `/accounts`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/accounts/{address}` | Balance, energy, hasCode |
| GET | `/accounts/{address}/code` | Contract bytecode |
| GET | `/accounts/{address}/storage/{key}` | Storage slot value |
| GET | `/accounts/{address}/storage/raw/{key}` | Raw storage bytes |
| POST | `/accounts/*` | Batch contract call (multiple clauses) |

Query param `revision` selects block (ID, number, or `best`).

Deprecated (requires `--api-enable-deprecated`): `POST /accounts`, `POST /accounts/{address}` for single calls.

### Blocks — `/blocks`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/blocks/{revision}` | Block by ID or number. Query: `raw`, `expanded` |

### Transactions — `/transactions`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/transactions` | Submit raw signed transaction |
| GET | `/transactions/{id}` | Fetch transaction. Query: `head`, `raw`, `pending` |
| GET | `/transactions/{id}/receipt` | Transaction receipt |

### Events — `/logs/event`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/logs/event` | Filter event logs by criteria, block range, pagination |

### Transfers — `/logs/transfer`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/logs/transfer` | Filter transfer logs by criteria, block range, pagination |

Both log endpoints are disabled when `--skip-logs` is set.

### Fees — `/fees`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/fees/history` | Fee history. Query: `blockCount`, `newestBlock`, `rewardPercentiles` |
| GET | `/fees/priority` | Suggested max priority fee per gas |

### Node — `/node`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/node/network/peers` | Connected peer stats |
| GET | `/node/txpool` | Pending txs (requires `--api-enable-txpool`) |
| GET | `/node/txpool/status` | Txpool count (requires `--api-enable-txpool`) |

### Debug — `/debug`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/debug/tracers` | Trace existing clause (target: blockID/txID/clauseIndex) |
| POST | `/debug/tracers/call` | Trace a simulated call |
| POST | `/debug/storage-range` | Storage range at clause execution point |

Optional pprof endpoints at `/debug/pprof/*` when `--api-pprof` is set.

### Subscriptions — `/subscriptions` (WebSocket)

| Path | Query Params | Payload |
|------|-------------|---------|
| `/subscriptions/block` | `pos` | New blocks |
| `/subscriptions/event` | `pos`, `addr`, `t0`–`t4` | Event logs |
| `/subscriptions/transfer` | `pos`, `txOrigin`, `sender`, `recipient` | Transfers |
| `/subscriptions/beat2` | `pos` | Beat2 heartbeat messages |
| `/subscriptions/txpool` | — | Pending transaction IDs |

`pos` (block ID) must be within backtrace limit (default 1000 blocks).

Deprecated: `/subscriptions/beat` (requires `--api-enable-deprecated`).

### Documentation — `/doc`

| Path | Description |
|------|-------------|
| `/` | Redirects to Stoplight UI |
| `/doc/thor.yaml` | OpenAPI YAML spec |
| `/doc/*` | Static assets (Swagger UI, Stoplight UI) |

Embedded via `//go:embed`.

## Admin API (Separate Server)

Runs on `--admin-addr` (default `localhost:2113`):

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/health` | Health status (block lag tolerance, peer count) |
| GET/POST | `/admin/loglevel` | Get/set log level (debug/info/warn/error/trace/crit) |
| GET/POST | `/admin/apilogs` | Get/toggle API request logging |

## Middleware Stack

Applied in order:

1. **RequestBodyLimit** — 200 KB max body
2. **APITimeout** — configurable, default 10s
3. **RequestLogger** — logs slow queries and 5xx responses
4. **Metrics** — counters and histograms (Prometheus)
5. **PanicRecovery** — recovers panics, optional stack trace logging
6. **XGenesisID** — validates/sets `x-genesis-id` header
7. **XThorestVersion** — sets `x-thorest-ver` header
8. **Compress** — gzip compression
9. **CORS** — configurable allowed origins (`--api-cors`), allows `content-type` and `x-genesis-id` headers

## Server Configuration

| Flag | Default | Description |
|------|---------|-------------|
| `--api-addr` | `localhost:8669` | API listen address |
| `--api-cors` | — | CORS allowed origins |
| `--api-timeout` | 10s | Request timeout |
| `--api-pprof` | false | Enable pprof endpoints |
| `--api-enable-txpool` | false | Enable txpool endpoints |
| `--api-enable-deprecated` | false | Enable deprecated endpoints |
| `--admin-addr` | `localhost:2113` | Admin server address |
| `--metrics-addr` | `localhost:2112` | Prometheus metrics address |
