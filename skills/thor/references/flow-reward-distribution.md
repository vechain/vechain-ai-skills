# Reward Distribution Flow

How block rewards are calculated and distributed to validators and delegators.

## Overview

```
runtime/ (per-tx reward) → energy/ (distribute) → staker/ (delegation split)
     │                          │                        │
  Calculate                  Credit VTHO            Split validator/delegator
```

## Two Reward Eras

| Era | Condition | Mechanism |
|-----|-----------|-----------|
| Pre-Galactica | `blockNumber < forkConfig.GALACTICA` | `rewardRatio` × gas price per tx |
| Post-Galactica (PoS) | `blockNumber ≥ forkConfig.GALACTICA` | Priority fee per tx + block reward from staking curve |

## Per-Transaction Reward (Both Eras)

**Package:** `runtime/` — in `PrepareTransaction().Finalize()`

### Pre-Galactica (PoA)

```go
rewardRatio := Params.Get(KeyRewardRatio)   // governance parameter
overallGasPrice := gasPrice + baseGasPrice * provedWork / txGas
reward := gasUsed * overallGasPrice * rewardRatio / 1e18
```

The reward is a **fraction** of gas cost, controlled by on-chain `RewardRatio` parameter. The remainder (gas cost minus reward) is burned.

### Post-Galactica (PoS)

```go
priorityFeePerGas := min(maxFeePerGas - baseFee, maxPriorityFeePerGas)
receipt.Reward = priorityFeePerGas * gasUsed
```

Priority fee goes entirely to the block proposer. The `baseFee` portion is burned (never credited).

### Crediting per-tx reward

In both eras, after computing `receipt.Reward`:

```go
Energy.Native(state, blockTime).Add(beneficiary, receipt.Reward)
```

This credits VTHO directly to the block's `Beneficiary` address.

## Block-Level Reward Distribution (PoS Only)

**Package:** `builtin/energy/energy.go` — `DistributeRewards()`

Called at block finalization in two places:
- **Packing path:** `Flow.Pack()` in `packer/flow.go`
- **Validation path:** `verifyBlock()` in `consensus/validator.go`

Both call:

```go
energy.DistributeRewards(beneficiary, signer, staker, blockNumber)
```

### Reward Calculation (`CalculateRewards`)

```go
totalStaked, _ := staker.LockedStake()          // in VET (not wei)
sqrtStake := sqrt(totalStaked) * 1e18           // convert to wei precision
curveFactor := Params.Get(KeyCurveFactor)       // governance parameter
reward := curveFactor * sqrtStake / blocksPerYear
```

The reward curve is sublinear (`reward ∝ √(totalStaked)`), incentivizing broad participation rather than stake concentration.

### Validator vs Delegator Split

```go
validatorRewardPerc := Params.Get(KeyValidatorRewardPercentage)  // e.g., 30
hasDelegations := staker.HasDelegations(signer)

if hasDelegations && validatorRewardPerc < 100 {
    proposerReward = reward * validatorRewardPerc / 100
    delegationReward = reward - proposerReward

    // Credit delegator reward to delegation contract address
    delegatorAddr := Params.Get(KeyDelegatorContractAddress)
    state.SetEnergy(delegatorAddr, existing + delegationReward)
    staker.IncreaseDelegatorsReward(signer, delegationReward, blockNumber)
}

// Credit validator reward to beneficiary
state.SetEnergy(beneficiary, existing + proposerReward)
energy.addIssued(reward)  // track total supply
```

**Key points:**
- If the validator has **no delegations**, they receive 100% of the block reward
- If delegated, the split is governed by `KeyValidatorRewardPercentage` (on-chain parameter)
- Delegator rewards are held in a contract address and tracked per-validator by `staker.IncreaseDelegatorsReward`
- `addIssued(reward)` increases the tracked VTHO total supply (for `totalSupply()` queries)

## VTHO (Energy) Generation

**Package:** `builtin/energy/`, `state/`

VTHO is generated in two ways:

### 1. Growth from VET holdings (pre-Hayabusa)

Every VET holder earns VTHO proportional to their balance over time:

```go
func (acc Account) CalcEnergy(blockTime, stopTime uint64) *big.Int {
    // energy += balance * (min(blockTime, stopTime) - acc.BlockTime) * energyGrowthRate
}
```

Rate: `5 × 10⁻⁸ VTHO per VET per second` (≈ 0.000432 VTHO/VET/day).

**Hayabusa fork** calls `Energy.StopEnergyGrowth()` which freezes growth at the fork block time. After this, VTHO only comes from block rewards.

### 2. Block rewards (post-Galactica)

As described above — `DistributeRewards` mints new VTHO each block.

## VTHO Burning

VTHO is burned in two places:

1. **Gas payment:** `ResolvedTransaction.BuyGas` deducts `gas × effectiveGasPrice` VTHO from payer. After execution, unused gas is refunded. The net burn = `gasUsed × effectiveGasPrice - receipt.Reward`.

2. **BaseFee (post-Galactica):** The baseFee portion of gas cost is implicitly burned — it is deducted from the payer but never credited to anyone. Only the priority fee goes to the proposer.

Burning is tracked via `Energy.totalAddSub` — `TotalBurned = TotalSub - TotalAdd`.

## BaseFee Mechanism (EIP-1559 Adapted)

**Package:** `consensus/upgrade/galactica/`

```go
func CalcBaseFee(parent, forkConfig) *big.Int {
    parentGasTarget = parent.GasLimit * GasTargetPercentage / 100
    if parentGasUsed > parentGasTarget:
        baseFee increases (min delta = 1)
    else:
        baseFee decreases (floor = InitialBaseFee)
}
```

Adjustment rate: `baseFeeChangeDenominator` (governance parameter, similar to Ethereum's 8).

## Reward Flow Diagram

```
                    ┌──────────────────────┐
                    │  Per-Tx Priority Fee  │
                    │ (runtime/ Finalize)   │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │  Block Staking Reward │
                    │ (energy/ Calculate)   │
                    │ √(totalStaked)*curve  │
                    └──────────┬───────────┘
                               │
              ┌────────────────┴────────────────┐
              │                                 │
    ┌─────────▼─────────┐            ┌─────────▼─────────┐
    │  Validator Share   │            │  Delegator Share   │
    │ validatorRewardPerc│            │ (100 - validatorRP)│
    │ → beneficiary VTHO│            │ → contract address │
    └───────────────────┘            │ → per-validator    │
                                     │   reward tracking  │
                                     └───────────────────┘
```

## Key Parameters (On-Chain Governance)

| Parameter | Key | Purpose |
|-----------|-----|---------|
| `KeyRewardRatio` | Pre-Galactica reward fraction | Fraction of gas cost given as reward |
| `KeyCurveFactor` | Block reward curve multiplier | Controls block reward magnitude |
| `KeyValidatorRewardPercentage` | Validator share of block reward | Split between validator and delegators |
| `KeyLegacyTxBaseGasPrice` | Base gas price for legacy txs | Floor price for legacy transactions |
| `KeyDelegatorContractAddress` | Delegator reward holding address | Where delegator rewards accumulate |
