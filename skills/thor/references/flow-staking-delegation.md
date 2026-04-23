# Staking and Delegation Flow

How validators stake, delegators participate, and the PoS transition works (Galactica upgrade).

## Overview

```
builtin/staker/ ← scheduler/ ← consensus/
      │                │              │
  Stake mgmt      PoS scheduling  Proposer validation
```

## Staker Contract Architecture

**Package:** `builtin/staker/`

The `Staker` struct composes four services:

| Service | Package | Responsibility |
|---------|---------|---------------|
| `validationService` | `staker/validation/` | Validator lifecycle (add, activate, exit, renew) |
| `delegationService` | `staker/delegation/` | Delegation CRUD and exit signaling |
| `aggregationService` | `staker/aggregation/` | Per-validator delegation totals |
| `globalStatsService` | `staker/globalstats/` | System-wide stake counters |

The contract is deployed at `builtin.Staker.Address` and uses native calls (Go code, not Solidity EVM).

## Step 1: Becoming a Validator

### Adding a Validation

`Staker.AddValidation(validator, endorser, period, stake)`

**Requirements:**
- Stake: `25M VET ≤ stake ≤ 600M VET` (`MinStakeVET` / `MaxStakeVET`)
- Validator address must not already exist
- Period must be one of: `LowStakingPeriod`, `MediumStakingPeriod`, `HighStakingPeriod`
- VET transferred to staker contract address

**State changes:**
1. `validationService.Add()` — creates `validation.Validation` in queued list
2. `globalStatsService.AddQueued(stake)` — increment global queued counter
3. `ContractBalanceCheck()` — invariant: `locked + queued + withdrawable + cooldown = contract balance`

### Validation States

```
Queued → Active → [Exit signaled] → Exit
```

| Status | Meaning |
|--------|---------|
| `StatusQueued` | Waiting for activation at next epoch boundary |
| `StatusActive` | In the leader group, eligible to produce blocks |
| `StatusExit` | Exited, stake withdrawable after cooldown |

### Key Type: `validation.Validation`

```go
type Validation struct {
    Endorser       thor.Address
    LockedVET      uint64        // currently locked stake
    Weight         uint64        // effective weight (may include multiplier)
    QueuedVET      uint64        // additional stake pending next period
    PendingUnlockVET uint64      // stake pending unlock at period end
    Status         Status
    Period         uint32        // staking period in blocks
    StartBlock     uint32        // when activated
    ExitBlock      *uint32       // when exit takes effect (nil if not signaled)
    OfflineBlock   *uint32       // when marked offline (nil if online)
    Beneficiary    *thor.Address // reward recipient override
}
```

## Step 2: Activation — Queued to Active

**Package:** `builtin/staker/housekeep.go`

Activation happens during **epoch transitions** via `Staker.Housekeep(currentBlock)`, called by `Staker.SyncPOS()` at every block.

Housekeep runs when `currentBlock % EpochLength == 0`:

1. **Eviction check** (every `EvictionCheckInterval`): validators offline for > `ValidatorEvictionThreshold` blocks get force-exited
2. **Renewals** (`UpdateGroup`): active validators at period end get their weight recalculated, queued stake promoted to locked
3. **Exits**: validators with `ExitBlock == currentBlock` are moved to exit status
4. **Activations**: queued validators promoted to leader group up to `MaxBlockProposers`

### Activation detail (`activateNextValidation`):

```go
validator, validation := validationService.NextToActivate(maxLeaderGroupSize)
aggregationService.Renew(validator)                    // consolidate delegation totals
validationService.ActivateValidator(validator, ...)    // set status=Active, startBlock
globalStatsService.ApplyRenewal(renewal)               // move queued→locked in counters
```

## Step 3: Delegation

### Adding a Delegation

`Staker.AddDelegation(validator, stake, multiplier, currentBlock) → delegationID`

**Requirements:**
- Validator must be `StatusQueued` or `StatusActive` (and not signaled exit)
- `stake > 0`, `multiplier > 0`
- Total TVL (validation + delegations) must not exceed `MaxStakeVET` (600M)

**State changes:**
1. `delegationService.Add()` → assigns `delegationID`, stores delegation starting at next iteration
2. `aggregationService.AddPendingVET()` → adds weighted stake to per-validator pending totals
3. `globalStatsService.AddQueued(stake)` → increment system queued counter
4. If validator is active: `validationService.AddToRenewalList()` → ensure renewal at next epoch

### Key Type: `delegation.Delegation`

```go
type Delegation struct {
    Validation    thor.Address   // validator this delegates to
    StartIteration uint32        // iteration when delegation activates
    LastIteration  *uint32       // iteration when delegation exits (nil = auto-renew)
    Stake         uint64         // staked VET amount
    Multiplier    uint8          // weight multiplier (longer lock = higher weight)
}
```

### Delegation Exit

`Staker.SignalDelegationExit(delegationID, currentBlock)`:
- Sets `LastIteration` to current iteration
- Updates aggregation to signal pending exit
- Delegation remains locked until iteration end, then becomes withdrawable

### Delegation Withdrawal

`Staker.WithdrawDelegation(delegationID, currentBlock) → amount`:
- Only if not started yet, or ended (past LastIteration)
- Returns VET to the delegator
- Updates global stats (remove from queued or withdrawable)

## Step 4: PoS Consensus Participation

### Leader Group Formation

Active validators form the **leader group**, queried via `Staker.LeaderGroup()`:

```go
type Leader struct {
    Address     thor.Address
    Endorser    thor.Address
    Active      bool           // online status
    Weight      uint64         // stake weight for scheduling
    Beneficiary *thor.Address  // reward recipient
}
```

### PoS Scheduling

**Package:** `scheduler/pos.go`

`PoSScheduler` uses the leader group for weighted random block assignment:

1. Seed from VRF chain: `Blake2b(VRF_beta, blockNumber)`
2. Each validator gets priority: `-ln(random) / weight` (A-Res weighted reservoir sampling)
3. Validators sorted by priority → deterministic slot order
4. Schedule advances in `BlockInterval` steps

### PoS Consensus Validation

**Package:** `consensus/pos_validator.go`

`validateStakingProposer(header, parent, staker)`:
1. Get signer from header
2. Get leader group (cached or from `staker.LeaderGroup()`)
3. Build `PoSScheduler` with leader group and VRF seed
4. Verify `sched.IsTheTime(header.Timestamp())` — signer is scheduled for this slot
5. Compute `updates, score = sched.Updates(timestamp)` — mark skipped validators as inactive
6. Verify `parent.TotalScore + score == header.TotalScore`

### Online/Offline Tracking

`Staker.SetOnline(validator, blockNum, online)`:
- Called during scheduling — validators that miss their slot are marked `Active: false`
- Offline validators can be evicted after `ValidatorEvictionThreshold` blocks
- Coming back online (producing a block) resets the offline counter

## Step 5: Reward Distribution for Stakers/Delegators

See `flow-reward-distribution.md` for full detail. Summary:

1. Block reward calculated: `curveFactor × √(totalStaked) / blocksPerYear`
2. If validator has delegations: split by `ValidatorRewardPercentage`
3. Validator share → beneficiary VTHO balance
4. Delegator share → delegation contract address, tracked per-validator via `IncreaseDelegatorsReward`

## Step 6: Unstaking and Cooldown

### Validator Exit

```
SignalExit(validator, endorser, currentBlock)
  → sets ExitBlock (at next period boundary)
  → at ExitBlock epoch: Housekeep moves to StatusExit

WithdrawStake(validator, endorser, currentBlock)
  → returns locked + queued + cooldown VET
  → updates global stats
```

### Cooldown Period

When a validator exits, their stake may go through a cooldown period before being withdrawable. The `globalStatsService` tracks three counters that reflect the lifecycle:

| Counter | Meaning |
|---------|---------|
| `queued` | Stake waiting to become active |
| `locked` | Actively staked and earning rewards |
| `withdrawable` | Exited and available for withdrawal |
| `cooldown` | Exited but still in cooldown period |

### Stake Increase/Decrease (Active Validators)

- `IncreaseStake`: adds to `QueuedVET` (takes effect next period)
- `DecreaseStake`: reduces `LockedVET - PendingUnlockVET` (next period)
- Both require endorser authorization and add validator to renewal list

## PoA → PoS Transition

**Package:** `builtin/staker/`, `consensus/upgrade/galactica/`

The transition is managed by `Staker.SyncPOS()`, called at every block:

1. **Hayabusa fork:** Staker contract deployed, energy growth stopped
2. **Transition period:** Authorities can migrate to staker contract. Authority endorsement checked via `TransitionPeriodBalanceCheck` which accepts both PoA endorsement and staker contract balance
3. **Galactica fork:** BaseFee activated, `DynamicFee` tx type enabled, Shanghai EVM opcodes
4. **PoS activation:** When enough validators have staked, `SyncPOS` returns `Active: true` and scheduling switches from PoA to PoS

### Contract Balance Invariant

`ContractBalanceCheck(pendingWithdraw)` is called after every state-changing operation:

```
locked + queued + withdrawable + cooldown + pendingWithdraw == contract VET balance
                                                            == effectiveVET (slot 0)
```

Any mismatch is a consensus-level error.
