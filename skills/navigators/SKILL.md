---
name: navigators
description: "VeBetterDAO Navigators feature: rewards multipliers (freshness + governance intent) and navigator delegation system. Use when working on navigator contracts, delegation, staking, freshness multiplier, governance intent multiplier, navigator fees, slashing, or any navigator-related frontend/backend code. Triggers on: navigator, navigators, delegation, freshness multiplier, governance intent, navigator staking, navigator fee, slashing, NavigatorRegistry."
allowed-tools: []
license: MIT
metadata:
  author: VeChain
  version: "0.3.0"
---

# VeBetterDAO Navigators Feature

Domain knowledge for the Navigators feature: rewards multipliers and navigator delegation system. Both phases ship together in one release.

## Phase 1: Rewards Multipliers

### Freshness Multiplier (Allocation Voting)

Applied at `VoterRewards.registerVote()` — modifies reward weight only, NOT on-chain voting power.

| Behavior | Multiplier |
|---|---|
| Updated this round (weekly) | x3 |
| Updated within 2 rounds (bi-weekly) | x2 |
| No update for >= 3 rounds | x1 |

- "Update" = adding/removing apps or changing weights
- Governance-configurable, must support decimals
- Navigator-delegated citizens **inherit navigator's freshness**

### Governance Intent Multiplier (Proposal Voting)

Applied at `VoterRewards.registerVote()` per-proposal at registration time. Each proposal is independent.

| Vote Type | Multiplier |
|---|---|
| For / Against | x1 |
| Abstain | x0.30 |

- Governance-configurable
- Navigator-delegated citizens **inherit navigator's decision multiplier**

## Phase 2: Navigator System

### Core Concepts

- **Navigator**: User who stakes B3TR to vote on behalf of delegating citizens
- **Citizen**: User who delegates specific VOT3 amount to a navigator
- Roles are **mutually exclusive** — navigators cannot be citizens of another navigator
- Citizens retain full VOT3 ownership but **delegated portion is locked**

### Registration

- Permissionless — stake minimum 50,000 B3TR in NavigatorRegistry
- Max stake: 1% of circulating VOT3 (enforced at deposit only, grandfathered)
- 10:1 delegation ratio: stake must be >= 10% of total delegated VOT3
- On-chain metadata URI for profile (same pattern as X2EarnApps)
- On-chain reports every 2 rounds via `submitReport(metadataURI)`
- Navigators cannot enable auto-voting (mutually exclusive)

### Delegation

- Citizens delegate a **specific VOT3 amount** (explicit choice, not full balance)
- VOT3 stays in wallet; delegated portion **locked** via `_update()`: `balance - delegatedAmount >= transferAmount`
- VOT3 stores delegation amounts (new mapping), NavigatorRegistry updates via privileged role
- One navigator per citizen
- Snapshotted at round start; mid-round changes take effect next round
- **Partial undelegation allowed** (takes effect next round)
- No personhood check for delegated citizens
- Citizens **cannot vote manually** while delegated — must exit first
- Auto-voting disabled when delegating
- Non-delegated VOT3 is idle (earns nothing)
- Delegation **rejected** if it would exceed navigator's capacity (10:1 ratio)

### Voting Mechanics

#### Allocation Voting (XAllocationVoting)

Two separate functions (NOT merged):
- `castVoteOnBehalfOf(voter, roundId)` — for auto-voting users (existing, unchanged)
- `castNavigatorVote(citizen, roundId)` — for navigator-delegated citizens (new)

```
castNavigatorVote(citizen, roundId):
  - Citizen must be delegated to a navigator
  - Navigator must have set allocation preferences for this round
  - NO personhood check
  - Voting power = delegated amount at round snapshot (checkpointed, NOT full VOT3 balance)
  - Uses navigator's app preferences (equal weight distribution)
  - Registers RelayerAction.VOTE for the caller
  - Emits NavigatorVoteCast(citizen, navigator, roundId, appIds, voteWeights)
```

- Navigator setting preferences = their own vote (personal VOT3 balance, staked B3TR not counted)
- Per-round voting data stored on-chain for slashing verification
- Delegation amounts are **checkpointed** (Checkpoints.Trace208) for snapshot queries

#### Governance Proposal Voting (B3TRGovernor - NEW)

```
castNavigatorVote(proposalId, citizen):
  - Citizen must be delegated to a navigator (via NavigatorRegistry)
  - Navigator must have set decision (1=Against, 2=For, 3=Abstain)
  - Voting power = delegated amount at proposal snapshot (checkpointed)
  - Registers vote with intent multiplier for rewards
  - Emits NavigatorGovernanceVoteCast(citizen, navigator, proposalId, support, weight, power)
```

### getVotes Reflects Delegation

`getVotes(account, timepoint)` on both governors subtracts the navigator-delegated amount, returning only undelegated voting power:
- `GovernorVotesLogic.getVotes` — `VOT3.getPastVotes - navigatorRegistry.getDelegatedAmountAtTimepoint`
- `VotesUtils.getVotes` (XAllocationVoting) — same subtraction via ExternalContractsStorage
- `getQuadraticVotingPower` — calls `getVotes`, so returns `sqrt(undelegated) * 1e9`
- `getTotalVotingPower` (XAllocationVoting) — cascades from `getVotes`
- Returns full balance when `navigatorRegistry == address(0)`
- **View-only**: actual `castVote` reads `getPastVotes` directly; delegated citizens already blocked; navigator votes use `getDelegatedAmountAtTimepoint`

### Relayer Integration

#### Key design: citizens NOT counted in expected actions (Option B)
- `startNewRound()` expected actions = auto-voting users ONLY
- Relayers serve citizens **voluntarily** and earn RelayerAction.VOTE credit
- Navigator slashing + relayer fee incentives drive service
- Avoids deadlock: if navigator doesn't set preferences, relayer rewards aren't blocked

#### Late preferences slashing
- Navigators must set preferences at least `preferenceCutoffPeriod` blocks (~24hr) before round deadline
- Setting later is allowed but incurs minor slash via `reportLatePreferences(navigator, roundId)`
- `preferencesSetBlock[navigator][roundId]` records when set

#### Auto-voting disabled on delegation
- `NavigatorRegistry.delegate()` calls `XAllocationVoting.disableAutoVotingFor(citizen)`
- Privileged function — only callable by NavigatorRegistry
- On undelegate: user re-enables auto-voting manually if desired

#### Relayer flow (per round)
1. Round starts -> relayer discovers citizens via `DelegationCreated/Removed` events
2. Relayer waits for `AllocationPreferencesSet` event from each navigator
3. Once navigator sets preferences: relayer calls `castNavigatorVote(citizen, roundId)` for each citizen
4. Round ends -> relayer calls `VoterRewards.claimReward(cycle, citizen)` — same function for all users
5. Both VOTE and CLAIM actions registered, relayer earns proportional share

#### Preferred relayer
- Navigator who is a registered relayer: `preferredRelayer` auto-set for citizens on delegation
- Citizens can override `preferredRelayer` to a different relayer anytime
- Navigators cannot enable auto-voting (prevents timing issues)

### Rewards & Fee Ordering

Fee ordering for citizens (deducted at `VoterRewards.claimReward`):
```
1. Navigator fee: deducted from gross reward first (% of total, goes to NavigatorRegistry fee escrow)
2. Relayer fee: deducted from remainder (% of post-nav amount, goes to RelayerRewardsPool)
3. Citizen receives the rest
```

Key rules:
- Rewards proportional to **delegated amount only** (checkpointed at round snapshot)
- Citizen's own GM level applies (not navigator's)
- Relayer fee applies to both auto-voters AND citizens (`hadAutoVoting || isDelegated`)
- Navigator fee applies to citizens only
- Fee deducted at reward claim time
- No navigator fee for non-delegated users
- CLAIM action registered for both auto-voters and citizens

### Fee Escrow

- Inside NavigatorRegistry: `navigator => round => feeAmount`
- Each round's fees claimable **4 rounds later** (rolling unlock)
- Major slash takes **all unclaimed locked fees**

**Example:** Fees earned: round 1 = 800, round 2 = 600, round 3 = 1000. Claimable: round 5 = 800, round 6 = 600, round 7 = 1000.

### Slashing

#### Minor (Automatic, 10% of current remaining stake — compounding)

Reportable by anyone via public function (like `checkEndorsementStatus` in X2EarnApps). Slashed funds to treasury.

Four triggers:
1. **Missed allocation vote** — had citizens, didn't set preferences for a round
2. **Missed governance proposal vote** — had citizens, didn't set decision during proposal's voting period
3. **Stale allocation preferences** — no update >= 3 rounds (same threshold as freshness multiplier)
4. **Missed report** — must submit every 2 rounds

**Example (compounding):** 50K stake -> slash 1: 5K (remaining 45K) -> slash 2: 4.5K (remaining 40.5K)

If stake drops below 50K minimum: stays active but **can't accept new delegations** until topped up.

#### Major (Governance process, up to 100% of stake + locked fees + removal)

For: manipulation, bribery, vote buying, undisclosed compensation.
Process: 5 navigators lock stakes to trigger -> public findings within 4 rounds -> governance vote.

### Deactivation

- Via governance proposal (anyone can propose) with on-chain execution
- Proposal includes **slash amount** (0-100% of stake + locked fees)
- Takes effect **next round** (current round completes normally)
- **Cannot reactivate** — must register fresh

### Exit

1. `announceExit()` — event emitted, **1 round notice** (governance-configurable)
2. **Lazy invalidation**: as soon as exit announced, all citizen delegations become void
   - `isDelegated()` returns false, `getDelegatedAmount()` returns 0
   - VOT3 transfer lock auto-releases (no citizen action needed)
   - Citizens can directly re-delegate to new navigator (stale delegation auto-cleared)
3. Navigator must continue voting during notice for citizens of that round
4. `finalizeExit()` — stake available **immediately**, locked fees on their individual 4-round schedules
5. Re-entry = fresh registration

### Lazy Invalidation (Citizen UX)

When a navigator exits or is deactivated, citizen delegations become void automatically at the view level:
- `_isNavigatorDead()` checks `isDeactivated || exitAnnouncedRound > 0`
- `getNavigator()`, `getDelegatedAmount()`, `isDelegated()` all return void values
- `getDelegatedAmountAtTimepoint()` NOT affected (historical data preserved for rewards)
- `delegate()` auto-clears stale delegation and emits `DelegationRemoved` when citizen re-delegates
- Zero gas cost — no iteration over citizens needed

### Contract-Level Protections

- **Self-delegation blocked**: navigator cannot delegate to themselves (`SelfDelegationNotAllowed`)
- **Citizens can't manual vote**: `castVote()` reverts with `DelegatedToNavigator` for delegated citizens
- **Citizens can't manual vote on governance**: `GovernorVotesLogic.castVote()` also checks
- **Navigators can't enable auto-voting**: `toggleAutoVoting()` reverts with `NavigatorCannotEnableAutoVoting`
- **Delegated citizens can't enable auto-voting**: `toggleAutoVoting()` reverts with `DelegatedToNavigator`

## Key Contracts

### Modified
- `VOT3.sol` — delegation amount mapping, `_update()` transfer restriction, privileged role for NavigatorRegistry
- `XAllocationVotingGovernor.sol` — navigator check in `castVoteOnBehalfOf`, store per-round voting data
- `B3TRGovernor.sol` — new `castVoteOnBehalfOf` for navigator citizens only, same early access
- `VoterRewards.sol` — multipliers at `registerVote()`, navigator fee at claim time

### New
- `NavigatorRegistry` — registration, staking, delegation, voting decisions, metadata, reports, fee escrow, slashing, deactivation, exit, relayer integration

### Dependencies (read-only)
- `VOT3.sol` — circulating supply for max stake cap
- `VeBetterPassport` — personhood checks (skipped for navigated citizens)
- `RelayerRewardsPool` — relayer registration check, `preferredRelayer` management

## Codebase Reference

### Navigator contracts
- `/packages/contracts/contracts/navigator/NavigatorRegistry.sol` — main facade, UUPS upgradeable
- `/packages/contracts/contracts/navigator/libraries/NavigatorStorageTypes.sol` — single ERC-7201 namespace
- `/packages/contracts/contracts/navigator/libraries/NavigatorStakingUtils.sol` — registration, stake/unstake
- `/packages/contracts/contracts/navigator/libraries/NavigatorDelegationUtils.sol` — delegation with checkpoints
- `/packages/contracts/contracts/navigator/libraries/NavigatorVotingUtils.sol` — preferences + decisions
- `/packages/contracts/contracts/navigator/libraries/NavigatorFeeUtils.sol` — per-round fee escrow
- `/packages/contracts/contracts/navigator/libraries/NavigatorSlashingUtils.sol` — minor + major slashing
- `/packages/contracts/contracts/navigator/libraries/NavigatorLifecycleUtils.sol` — exit, deactivation, reports
- `/packages/contracts/contracts/interfaces/INavigatorRegistry.sol` — full interface

### Modified contracts
- `/packages/contracts/contracts/x-allocation-voting-governance/XAllocationVoting.sol` — castNavigatorVote, disableAutoVotingFor
- `/packages/contracts/contracts/x-allocation-voting-governance/libraries/VotesUtils.sol` — getVotes subtracts navigator delegation
- `/packages/contracts/contracts/governance/B3TRGovernor.sol` — castNavigatorVote
- `/packages/contracts/contracts/governance/libraries/GovernorVotesLogic.sol` — castNavigatorVote logic, getVotes subtracts navigator delegation
- `/packages/contracts/contracts/governance/libraries/GovernorStorageTypes.sol` — navigatorRegistry field
- `/packages/contracts/contracts/governance/libraries/GovernorConfigurator.sol` — setNavigatorRegistry
- `/packages/contracts/contracts/VoterRewards.sol` — navigator fee deduction, relayer fee for citizens
- `/packages/contracts/contracts/VOT3.sol` — NAVIGATOR_ROLE, setNavigatorLockedAmount, _update lock
- `/packages/contracts/contracts/x-allocation-voting-governance/libraries/XAllocationVotingStorageTypes.sol` — navigatorRegistry in ExternalContracts
- `/packages/contracts/contracts/x-allocation-voting-governance/libraries/ExternalContractsUtils.sol` — setNavigatorRegistry

## Not in v1

1. Navigator-configurable fee rates (fixed 20%)
2. Staked B3TR counting as navigator voting power
3. B3TR -> VOT3 conversion during staking

## All Resolved Design Decisions

1. No personhood check for navigator-delegated citizens
2. Navigators vote on BOTH allocation and governance proposals
3. B3TRGovernor: `castNavigatorVote(proposalId, citizen)` — separate function (not merged with castVote)
4. XAllocationVoting: `castNavigatorVote(citizen, roundId)` — separate from `castVoteOnBehalfOf`
5. Votes blocked until navigator sets decision/preferences
6. Citizens delegate specific VOT3 amount (not full balance)
7. Delegated VOT3 locked via VOT3._update() — only delegated portion locked, rest free to transfer/convert
8. Delegation amounts checkpointed (Checkpoints.Trace208) for snapshot queries at voting time
9. Partial undelegation allowed (takes effect next round)
10. Freshness multiplier inherited from navigator
11. Governance intent multiplier inherited from navigator's decision
12. Fee ordering: navigator fee first (% of gross), then relayer fee (% of remainder)
13. Navigators can't delegate to other navigators (mutually exclusive)
14. Navigator's own vote = automatic when setting preferences/decisions (personal VOT3, not staked B3TR)
15. Deactivation takes effect next round
16. No citizen override — can't vote manually while delegated
17. Same early access model for B3TRGovernor
18. Both phases ship together
19. Same preference format as auto-voting (app IDs, equal weight)
20. Rewards proportional to delegated amount only (at snapshot)
21. Citizen's GM level applies
22. Relayer fee applies to both auto-voters AND citizens
23. Navigator fee applies to citizens only
24. preferredRelayer auto-set on delegation (if navigator is relayer), cleared on full exit
25. Citizens can override preferredRelayer
26. Fee escrow inside NavigatorRegistry, per-round, 4-round lock
27. Minor slash = 10% of current remaining stake (compounding)
28. Below minimum after slash = active but can't accept new delegations
29. Max stake cap enforced at deposit only
30. Delegation rejected if exceeds capacity
31. Exit: 1 round notice, must keep voting, stake immediate, fees on schedule
32. Deactivation by governance proposal, includes slash amount
33. No reactivation — fresh registration required
34. On-chain reports every 2 rounds, missed = minor infraction
35. Navigator stakes B3TR
36. Navigators cannot enable auto-voting
37. Multipliers applied at registerVote(), don't affect on-chain voting power
38. Per-proposal governance intent — each proposal independent
39. Citizens NOT counted in relayer expected actions (Option B) — avoids deadlock if navigator fails
40. Late preferences slashing: must set at least 24hr before round deadline, otherwise minor slash
41. Auto-voting auto-disabled on delegation via `disableAutoVotingFor` privileged call
42. `castNavigatorVote` registers `RelayerAction.VOTE` for the caller
43. CLAIM action registered for citizens at reward claim time (same as auto-voters)
44. Permissionless registration (50,000 B3TR minimum stake)
45. Major slash forfeits all unclaimed locked fees (`feesForfeited` flag)
46. Lazy invalidation: citizen delegations auto-void when navigator exits/deactivated (view-level, zero gas)
47. Citizens can re-delegate directly to new navigator without calling undelegate first (stale delegation auto-cleared)
48. Self-delegation blocked: navigator cannot delegate to themselves (`SelfDelegationNotAllowed`)
49. Delegated citizens cannot manual castVote (`DelegatedToNavigator` error)
50. Navigators cannot enable auto-voting (`NavigatorCannotEnableAutoVoting`)
51. Delegated citizens cannot enable auto-voting (`DelegatedToNavigator`)
52. `getDelegatedAmountAtTimepoint` NOT affected by lazy invalidation (historical data preserved for rewards)
53. `getVotes` subtracts navigator-delegated amount on both governors (view-only, castVote unaffected)
