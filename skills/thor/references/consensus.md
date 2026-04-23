# Consensus Mechanisms

Thor uses a hybrid consensus model that evolved through several forks:
**PoA v1** → **PoA v2** (VIP-214) → **BFT finality** (FINALITY fork) → **PoS** (HAYABUSA/GALACTICA).

## Proof of Authority (PoA)

Authority nodes are registered on-chain via the `Authority` built-in contract. Each authority node has a master address, an endorser (who stakes VET as collateral), and an identity hash.

### Endorsement Requirement

A proposer is only eligible if its endorser's VET balance meets the `proposer-endorsement` governance parameter (initially 25M VET). After HAYABUSA, queued stake in the Staker contract also counts toward this balance check.

### PoA v1 (Pre-VIP-214)

- **Packages**: `scheduler/poa_v1.go`, `consensus/poa_validator.go`
- Active authority nodes are collected from the `Authority` contract
- Proposer for each time slot determined by DPRP: `H(parentBlockNumber, blockTime)[:8] % len(actives)`
  - `H` = Blake2b hash
- Each block time slot is `T` = 10 seconds apart
- If a scheduled proposer misses its slot, it gets deactivated; the producing proposer gets a score equal to the count of remaining active proposers
- No seed or VRF involved — deterministic from block number + time

### PoA v2 (Post-VIP-214)

- **Packages**: `scheduler/poa_v2.go`
- Proposer list is **shuffled** using a VRF-derived seed
- Shuffle key: `Blake2b(seed, parentBlockNumber, proposerAddress)` — sorted to create a deterministic sequence
- Seed comes from the `Beta` output of a previous block's VRF proof (via `scheduler/seed.go`)
- Time slot assignment: proposer at index `(offset) % len(shuffled)` where offset is derived from elapsed slots
- Missed proposers are still deactivated; score = remaining active count

### PoA → PoS: Key Differences

| Aspect | PoA v1 | PoA v2 | PoS |
|--------|--------|--------|-----|
| Proposer selection | DPRP hash | VRF-seeded shuffle | Weighted random sampling |
| Score model | Active count | Active count | Active weight / total weight × 10000 |
| Validator source | Authority contract | Authority contract | Staker contract (leader group) |
| Weight | Equal (1 per node) | Equal (1 per node) | Proportional to stake |

## Proof of Stake (PoS) — HAYABUSA / GALACTICA

### Transition to PoS

The transition is managed by `builtin/staker/transition.go`:

1. After HAYABUSA fork, authority nodes can register in the Staker contract (requires existing authority listing during transition period)
2. At each epoch boundary (every `EpochLength` blocks), `staker.SyncPOS()` checks if ≥ 2/3 of `maxBlockProposers` are queued in the Staker contract
3. When threshold is met, queued validators are activated and PoS takes over proposer selection
4. Once active, the Authority contract is no longer used for proposer selection

### PoS Scheduler

- **Package**: `scheduler/pos.go`
- Uses **A-Res reservoir sampling** for weighted random proposer ordering:
  - For each validator: `score = -ln(random) / weight`
  - Sort by score ascending — lower score = higher priority
  - `random` is from a ChaCha8 PRNG seeded with `Blake2b(vrfSeed, parentBlockNumber)`
- Higher stake → higher weight → statistically more likely to get earlier slots
- Time slot and missed-proposer logic identical to PoA v2

### Validator Requirements

| Parameter | Value |
|-----------|-------|
| Min stake | 25,000,000 VET |
| Max stake | 600,000,000 VET |
| Staking periods | Low / Medium / High (governance-defined) |
| Endorser | Required (same address manages the validation) |
| Beneficiary | Optional; directs block rewards to a different address |

### Validator Lifecycle

```
AddValidation (queued)
  → transition() activates when 2/3 threshold met
  → active (producing blocks, earning rewards)
  → SignalExit → ExitBlock calculated based on staking period
  → exit status → WithdrawStake
```

Validators can also: `IncreaseStake`, `DecreaseStake`, `SetBeneficiary`, `SetOnline`/offline.

### Delegation

Delegators stake VET against an active or queued validator:
- `AddDelegation(validator, stake, multiplier)` — multiplier affects weight calculation
- `SignalDelegationExit` → waiting for period end → `WithdrawDelegation`
- Delegator rewards accumulate per-validator and per-staking-period

## BFT Finality Engine

- **Package**: `bft/`
- Activated at the `FINALITY` fork
- Implements Casper-like justified/finalized checkpoint logic (described in VIP-220)
- **Epoch**: a fixed number of blocks (`EpochLength`)

### Core Concepts

| Term | Meaning |
|------|---------|
| **Checkpoint** | First block of an epoch |
| **Quality** | Accumulated count of justified epochs |
| **Justified** | An epoch where >2/3 of validators (by count pre-HAYABUSA, by weight post-HAYABUSA) participated |
| **Committed** | An epoch where >2/3 voted COM (commit) |
| **Finalized** | A checkpoint whose quality is `current_quality - 1` after a committed epoch |
| **COM bit** | Block header flag — proposer votes to commit the current epoch's checkpoint |

### Justification & Finality Flow

```
Epoch N blocks produced
  → at store point (last block of epoch): computeState()
    → justifier collects votes from all blocks in the epoch
    → if unique signers > 2/3 of maxBlockProposers → epoch is JUSTIFIED (quality++)
    → if COM voters > 2/3 → epoch is COMMITTED
  → if committed AND quality > 1 → checkpoint at quality-1 becomes FINALIZED
  → finalized block ID persisted to DB
```

### Vote Safety (VIP-220)

`ShouldVote()` ensures a proposer never votes COM on conflicting checkpoints:
- Tracks past votes via `casts`
- Will not vote COM if a recent vote (within `quality ± 1`) conflicts with the current chain's justified checkpoint
- Prevents equivocation across forks

### Pre-HAYABUSA vs Post-HAYABUSA BFT

- **Pre-HAYABUSA**: threshold = `maxBlockProposers * 2/3` (vote count)
- **Post-HAYABUSA**: threshold = `totalWeight * 2/3` (stake-weighted); each validator's vote carries its staking weight

### Solo Mode

Solo uses a `soloMockedEngine` that simulates finality:
- Every epoch assumed committed
- `finalized = currentCheckpoint - 2 * EpochLength`
- `justified = currentCheckpoint - 1 * EpochLength`
- Enables pruner to work in solo mode

## VRF (Verifiable Random Function)

- **Package**: `vrf/`
- Algorithm: ECVRF-SECP256K1-SHA256-TAI (suite string `0xfe`)
- Uses `github.com/vechain/go-ecvrf`
- `Prove(sk, alpha)` → `(beta, pi)` — beta is the random output, pi is the proof
- `Verify(pk, alpha, pi)` → `beta` — anyone can verify without the private key

### Chained VRF in Blocks (Post-VIP-214)

- Block header contains `Alpha` (VRF input) and a VRF proof in the signature
- `Alpha` = parent block's `Beta` (VRF output), or parent's `StateRoot` for the initial value
- `Beta` is extracted from the block's complex signature
- The `Seeder` (`scheduler/seed.go`) uses Beta from a block one epoch behind as the seed for proposer shuffling

## Fork History

| Fork | Block (Mainnet) | Key Changes |
|------|----------------|-------------|
| **VIP-191** | 3,337,300 | Fee delegation — transactions can designate a gas payer |
| **ETH_CONST** | 3,337,300 | Align gas constants with Ethereum |
| **BLOCKLIST** | 4,817,300 | Blocked addresses cannot originate or delegate transactions |
| **ETH_IST** | 9,254,300 | Ethereum Istanbul EVM opcodes |
| **VIP-214** | 10,653,500 | PoA v2: VRF-seeded proposer shuffling, complex signatures (65→162 bytes), chained VRF |
| **FINALITY** | 13,815,000 | BFT finality engine: justified/finalized checkpoints, COM voting, epoch-based quality tracking |
| **GALACTICA** | 22,084,200 | EIP-1559 base fee, typed transactions, Staker built-in contract, reward distribution changes |
| **HAYABUSA** | 23,414,400 | PoA-to-PoS transition period; stake-weighted BFT (weight replaces vote count); authority nodes can migrate to Staker contract |
