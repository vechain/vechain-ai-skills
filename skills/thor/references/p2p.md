# P2P Networking

Thor uses Ethereum-derived devp2p networking: **discv5** for peer discovery, **RLPx** for encrypted connections,
and a custom `thor/1` protocol for block and transaction propagation. Default P2P port: **11235**.

## Discovery — discv5

Located in `p2p/discv5/`. Ethereum-style v5 topic discovery over UDP.

- Kademlia-like DHT with XOR distance metric
- Topic-based: nodes register/search by `thor1@<genesisID[24:]>`
- 257 buckets, 16 nodes per bucket, concurrency factor (alpha) = 3

### UDP Packet Types

| Packet | Purpose |
|--------|---------|
| `ping` / `pong` | Liveness check |
| `findnode` / `neighbors` | Node lookup |
| `findnodeHash` | v5 lookup by hash |
| `topicRegister` / `topicQuery` / `topicNodes` | Topic discovery |

### Key Constants

| Constant | Value |
|----------|-------|
| Protocol version | 4 |
| Response timeout | 500ms |
| Packet expiration | 20s |
| Max packet size | 1280 bytes |
| Max neighbors per response | ~12 |
| Max findnode failures | 5 |
| Seed count | 30 |
| Seed max age | 5 days |
| Bucket refresh interval | 1 min |
| Auto-refresh interval | 1 hour |

## ENR (Ethereum Node Records)

Located in `p2p/enr/`. EIP-778 style records, max 300 bytes.

| Entry Key | Type | Purpose |
|-----------|------|---------|
| `id` | `"v4"` | Identity scheme |
| `secp256k1` | compressed pubkey | Node identity |
| `ip` | IPv4/IPv6 | Network address |
| `tcp` | uint16 | TCP port |
| `udp` | uint16 | UDP discovery port |

Signing uses `secp256k1-keccak` identity scheme (Keccak256 of RLP-encoded record).

## NAT Traversal

Located in `p2p/nat/`. Interface for port mapping.

| Value | Mechanism |
|-------|-----------|
| `none` / `off` / `""` | No mapping |
| `any` / `auto` / `on` | Auto-detect (UPnP or NAT-PMP) |
| `upnp` | UPnP |
| `pmp` / `natpmp` | NAT-PMP |
| `extip:<IP>` | Fixed external IP |

Mapping timeout: 20 min, update interval: 15 min. Maps both TCP (P2P) and UDP (discovery).

## P2P Server

Two layers:

### p2psrv.Server (`p2psrv/`)

High-level wrapper that integrates discv5 with the devp2p server:

- Starts discv5 UDP listener
- NAT mapping for UDP port
- Registers genesis topic (`thor1@<genesisID[24:]>`)
- Runs discovery loop → feeds discovered nodes to dial loop
- Manages peer caches: `discoveredNodes` (RandCache, 128), `knownNodes` (PrioCache, 5)

### p2p.Server (`p2p/server.go`)

Low-level devp2p server:

- RLPx encrypted TCP connections
- Protocol negotiation via capabilities
- Connection flags: `dynDialedConn`, `staticDialedConn`, `inboundConn`, `trustedConn`

### Connection Management

| Setting | Value |
|---------|-------|
| `--max-peers` | 25 (default) |
| `--p2p-port` | 11235 |
| Max active dial tasks | 16 |
| Default max pending peers | 50 |
| Dial timeout | 15s |
| Frame read timeout | 30s |
| Frame write timeout | 20s |
| DialRatio | `sqrt(MaxPeers)` |

Inbound limit: `MaxPeers - maxDialedConns`. Trusted peers bypass limits.

Dial pacing: 500ms for first 20 dials, 2s after, 10s when >50% peers connected.

## Comm Protocol — Block & Transaction Propagation

Located in `comm/`. Protocol: `thor/1`, max message size 10 MB.

### Message Types

| Code | Message | Type | Purpose |
|------|---------|------|---------|
| 0 | `MsgGetStatus` | Call | Handshake / status exchange |
| 1 | `MsgNewBlockID` | Notify | Announce new block (ID only) |
| 2 | `MsgNewBlock` | Notify | Broadcast full block |
| 3 | `MsgNewTx` | Notify | Broadcast transaction |
| 4 | `MsgGetBlockByID` | Call | Request block by ID |
| 5 | `MsgGetBlockIDByNumber` | Call | Request block ID by number |
| 6 | `MsgGetBlocksFromNumber` | Call | Request batch of blocks (sync) |
| 7 | `MsgGetTxs` | Call | Sync transactions |

### Block Propagation

- `BroadcastBlock()`: `sqrt(peers)` receive `MsgNewBlock` (full block), remaining peers get `MsgNewBlockID`
- Announced block IDs trigger fetch via `MsgGetBlockByID` in the announcement loop

### Transaction Propagation

- `txsLoop` subscribes to the tx pool
- `MsgNewTx` sent to peers that haven't seen the transaction
- After sync completes: `syncTxs()` via `MsgGetTxs` for catch-up

### Sync

`Sync()` selects the best peer (highest total score) and runs `download()` using `MsgGetBlocksFromNumber` to fetch block batches.

## Bootstrap Nodes

### disco Command (`cmd/disco/`)

Standalone bootstrap node — UDP-only discv5 listener, no TCP, no thor protocol.

| Flag | Default | Purpose |
|------|---------|---------|
| `--addr` | `:55555` | Listen address |
| `--keyfile` | auto | Private key file |
| `--keyhex` | — | Private key as hex |
| `--nat` | `none` | NAT mechanism |
| `--netrestrict` | — | CIDR whitelist |

### Node Sources

1. **Hardcoded fallback**: 11 bootstrap nodes in `cmd/thor/p2p/bootstrap.go` (port 55555)
2. **Remote list**: `https://vechain.github.io/bootstraps/node.list` (HTTP enode URLs)
3. **Peer cache**: `peers.cache` in instance dir — known nodes saved on shutdown

## Default Ports

| Port | Protocol | Use |
|------|----------|-----|
| 11235 | TCP | P2P connections (RLPx) |
| 55555 | UDP | Bootstrap node discovery |

## Component Wiring

```
cmd/thor/main.go
  → newP2PCommunicator()
    → p2psrv.New(opts)         // wraps p2p.Server, manages discv5
    → comm.New(...)            // block/tx propagation logic
  → p2pCommunicator.Start()
    → p2psrv.Start(comm.Protocols(), comm.DiscTopic())
      → p2p.Server.Start()    // TCP listener
      → discv5.ListenUDP()    // UDP discovery
      → RegisterTopic("thor1@<genesisID>")
      → discoverLoop() + dialLoop()
    → comm.Start()             // sync, broadcast loops
```
