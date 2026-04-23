# Built-in Contracts

Built-in contracts are native to the VeChainThor blockchain. Unlike regular Solidity contracts, they:

- Have **deterministic addresses** derived from their name: `thor.BytesToAddress([]byte("ContractName"))`
- Are **not deployed via transactions** — their bytecode is loaded at genesis
- Have **native method implementations** in Go that bypass the EVM for core operations
- Solidity ABI is still used for encoding/decoding — callers interact via normal contract calls
- Some older contracts (compiled with Solidity 0.4.24) return unused gas to the caller

**Package**: `builtin/` — `builtin.go` defines all contract bindings, each `*_native.go` file registers native method handlers.

## Contract Overview

| Contract | Address | Purpose |
|----------|---------|---------|
| **Authority** | `0x...Authority` | PoA authority node registry |
| **Energy** | `0x...Energy` | VTHO token (ERC20-like) |
| **Params** | `0x...Params` | On-chain governance parameters |
| **Prototype** | `0x...Prototype` | Account metadata: master, sponsors, credit plans |
| **Extension** | `0x...Extension` | Block/tx introspection from Solidity |
| **Executor** | `0x...Executor` | On-chain governance executor |
| **Staker** | `0x...Staker` | PoS staking, delegation, rewards (post-GALACTICA) |
| **Measure** | `0x...Measure` | Block measurement contract |

> Addresses are computed as `thor.BytesToAddress([]byte(name))`. For example, Authority's address = `BytesToAddress([]byte("Authority"))`.

## Authority

**File**: `builtin/authority_native.go`, `builtin/authority/authority.go`

Manages the list of PoA authority nodes. Each entry has a master address, endorser, identity hash, and active flag. Stored as a linked list in contract storage.

### Native Methods

| Method | Description |
|--------|-------------|
| `native_executor` | Returns the executor address from Params |
| `native_add(nodeMaster, endorsor, identity)` | Register a new authority node |
| `native_revoke(nodeMaster)` | Remove an authority node |
| `native_get(nodeMaster)` | Get node info: listed, endorser, identity, active |
| `native_first` | First node in the linked list |
| `native_next(nodeMaster)` | Next node in the linked list |
| `native_isEndorsed(nodeMaster)` | Check if endorser meets the VET endorsement requirement |

After HAYABUSA, `native_isEndorsed` also considers queued VET in the Staker contract (transition period logic).

## Energy (VTHO)

**File**: `builtin/energy_native.go`, `builtin/energy/energy.go`

VTHO is the gas/fee token. It is generated automatically from VET holdings at a fixed growth rate (~0.000432 VTHO per VET per day). Energy also handles total supply tracking and reward distribution.

### Native Methods

| Method | Description |
|--------|-------------|
| `native_totalSupply` | Total VTHO supply |
| `native_totalBurned` | Total VTHO burned |
| `native_get(addr)` | VTHO balance of an address (includes accrued growth) |
| `native_add(addr, amount)` | Credit VTHO to an address |
| `native_sub(addr, amount)` | Debit VTHO from an address |
| `native_master(addr)` | Get the master address of an account |

Post-GALACTICA, the Energy contract also handles `DistributeRewards` — splitting block rewards between the proposer, validator beneficiary, and delegator reward pools.

### VTHO Generation

VTHO is not minted per-block. Instead, each account's VTHO balance is calculated on-the-fly based on:
- Last recorded energy balance
- VET balance × growth rate × elapsed time since last update

Growth rate: `5,000,000,000 wei VTHO per VET per second` ≈ 0.000432 VTHO/VET/day.

## Params

**File**: `builtin/params_native.go`, `builtin/params/params.go`

Generic key-value store for on-chain governance parameters. Only the Executor contract can write to it.

### Native Methods

| Method | Description |
|--------|-------------|
| `native_executor` | Returns the executor address |
| `native_get(key)` | Read a parameter value |
| `native_set(key, value)` | Write a parameter value (executor only) |

### Key Parameters

| Key | Purpose | Initial Value |
|-----|---------|---------------|
| `executor` | Governance executor address | Set at genesis |
| `reward-ratio` | Block reward ratio | 30% (3e17) |
| `validator-reward-percentage` | Validator share of rewards | 30% |
| `base-gas-price` | Legacy tx default gas price | 1e15 wei |
| `proposer-endorsement` | VET required to endorse a proposer | 25,000,000 VET |
| `max-block-proposers` | Max authority/validator count | 101 |
| `curve-factor` | VTHO issuance curve factor (post-PoS) | 76,800 |
| `delegator-contract-address` | Delegator contract address | — |
| `staker-switches` | Bit flags to pause staker/stargate | — |

## Prototype

**File**: `builtin/prototype_native.go`, `builtin/prototype/prototype.go`

Provides per-account metadata: master address, credit plans, user lists, and sponsor mechanism. Central to VeChain's multi-party payment protocol (MPP).

### Native Methods

| Method | Description |
|--------|-------------|
| `native_master(self)` | Get account's master address |
| `native_setMaster(self, newMaster)` | Set account's master |
| `native_balanceAtBlock(self, blockNum)` | Historical VET balance (within MaxStateHistory) |
| `native_energyAtBlock(self, blockNum)` | Historical VTHO balance |
| `native_hasCode(self)` | Check if account has contract code |
| `native_storageFor(self, key)` | Read account's storage slot |
| `native_creditPlan(self)` | Get credit plan (credit, recoveryRate) |
| `native_setCreditPlan(self, credit, rate)` | Set credit plan |
| `native_isUser(self, user)` | Check if address is a user of the contract |
| `native_addUser(self, user)` | Add user |
| `native_removeUser(self, user)` | Remove user |
| `native_sponsor(self, sponsor)` | Register as sponsor |
| `native_unsponsor(self, sponsor)` | Unregister as sponsor |
| `native_isSponsor(self, sponsor)` | Check sponsor status |
| `native_selectSponsor(self, sponsor)` | Select active sponsor |
| `native_currentSponsor(self)` | Get current sponsor |

### Multi-Party Payment (MPP)

A contract can set a credit plan so users get free gas up to a credit limit, with a recovery rate. Sponsors can volunteer to pay for a contract's users. This enables gasless UX.

## Extension

**File**: `builtin/extension_native.go`

Provides Solidity-accessible introspection into block and transaction context. Has three versions (Extension, ExtensionV2, ExtensionV3) — V3 is the active native ABI.

### Native Methods

| Method | Description |
|--------|-------------|
| `native_blake2b256(data)` | Blake2b hash (VeChain's native hash) |
| `native_blockID(blockNum)` | Block ID by number |
| `native_blockTotalScore(blockNum)` | Total score at block |
| `native_blockTime(blockNum)` | Timestamp at block |
| `native_blockSigner(blockNum)` | Signer of a block |
| `native_totalSupply` | VET total supply |
| `native_txProvedWork` | PoW proved work of current tx |
| `native_txID` | Current transaction ID |
| `native_txBlockRef` | Current tx block reference |
| `native_txExpiration` | Current tx expiration |
| `native_txGasPayer` | Gas payer of current tx |
| `native_txClauseIndex` | Current clause index within multi-clause tx |
| `native_txClauseCount` | Total clause count of current tx |

## Executor

**File**: `builtin/builtin.go` (binding only — `executor_test.go` exists)

The on-chain governance contract. Proposals can be voted on by authority nodes to change governance parameters, add/remove authorities, or execute arbitrary calls. It is the only entity authorized to call `Params.set()`.

## Staker

**File**: `builtin/staker_native.go`, `builtin/staker/staker.go`

Introduced with GALACTICA. Manages PoS validator registration, staking, delegation, and rewards.

### Architecture

The Staker contract delegates to sub-services:

| Sub-package | Purpose |
|-------------|---------|
| `staker/validation` | Validator registry — linked list of active/queued/exited validators |
| `staker/delegation` | Delegation records — delegators staking against validators |
| `staker/aggregation` | Per-validator aggregate stats (locked/pending VET + weight) |
| `staker/globalstats` | Global totals: locked, queued, withdrawable, cooldown |
| `staker/stakes` | Weighted stake calculation (stake × multiplier) |

### Native Methods — Validation

| Method | Description |
|--------|-------------|
| `native_addValidation(validator, endorser, period, stake)` | Register a new validator (25M–600M VET) |
| `native_signalExit(validator, endorser)` | Signal intent to exit (calculates exit block) |
| `native_increaseStake(validator, endorser, amount)` | Increase active validator's stake |
| `native_decreaseStake(validator, endorser, amount)` | Decrease stake (must stay ≥ 25M VET) |
| `native_withdrawStake(validator, endorser)` | Withdraw after exit |
| `native_setBeneficiary(validator, endorser, beneficiary)` | Set reward recipient address |
| `native_getValidation(validator)` | Get validator info: endorser, locked/queued VET, weight, status, period, blocks |
| `native_getWithdrawable(validator)` | Get withdrawable amount |
| `native_firstActive` / `native_firstQueued` | Linked list traversal |
| `native_next(prev)` | Next validator in list |
| `native_getValidationsNum` | Count of active + queued validators |
| `native_getValidationTotals(validator)` | Total locked/queued/exiting stake + weight for a validator |

### Native Methods — Delegation

| Method | Description |
|--------|-------------|
| `native_addDelegation(validator, stake, multiplier)` | Delegate VET to a validator |
| `native_signalDelegationExit(delegationID)` | Signal delegation exit |
| `native_withdrawDelegation(delegationID)` | Withdraw delegated stake |
| `native_getDelegation(delegationID)` | Get delegation info |
| `native_getDelegatorsRewards(validator, period)` | Accumulated delegator rewards |
| `native_getDelegatorContract` | Reads delegator contract address from Params |

### Native Methods — Global

| Method | Description |
|--------|-------------|
| `native_totalStake` | Total locked VET and weight across all validators |
| `native_queuedStake` | Total queued VET |
| `native_issuance` | Current block reward issuance amount |
| `native_getControlSwitches` | Staker/stargate pause flags |

### Staking Rules

| Rule | Value |
|------|-------|
| Min stake per validator | 25,000,000 VET |
| Max stake per validator | 600,000,000 VET (including delegations) |
| Staking periods | Low / Medium / High (governance-configurable) |
| Delegation multiplier | 1–N; affects weight calculation: `stake × multiplier` |
| PoS activation | ≥ 2/3 of `maxBlockProposers` queued → auto-activates at epoch boundary |
| Exit | Signal → wait for period end → exit block → withdraw |

### Validator States

```
StatusQueued → (transition when 2/3 threshold met) → StatusActive → (signalExit) → StatusExit
```

- **Queued**: registered but not yet producing blocks
- **Active**: producing blocks, earning rewards, stake is locked
- **Exit**: waiting for/past exit block, stake can be withdrawn

### Rewards

Post-GALACTICA, block rewards are distributed via `Energy.DistributeRewards()`:
- `validator-reward-percentage` (default 30%) goes to the block proposer's beneficiary
- Remaining goes to the delegator reward pool for that validator
- VTHO issuance is calculated using the `curve-factor` parameter

### Transition Period (HAYABUSA)

During the HAYABUSA transition period:
- Authority nodes can register in the Staker contract (`AddValidation` requires existing authority listing)
- Queued VET counts toward endorsement checks in the Authority contract
- PoA remains active until ≥ 2/3 of maxBlockProposers have queued
- Once threshold is met, all queued validators activate and PoS takes over

## How Native Calls Work

1. When the EVM encounters a `CALL` to a built-in contract address, `FindNativeCall` in `builtin.go` matches the method selector
2. If a native method is found, the Go implementation runs directly (no EVM bytecode execution)
3. Native methods receive an `xenv.Environment` providing access to state, block context, gas metering, and event logging
4. For older contracts (Authority, Energy, Params, Prototype, Extension), unused gas is returned to the caller
5. The Staker contract uses a different pattern: errors that are `Revert` type cause the EVM to revert with a reason string; unexpected errors panic
