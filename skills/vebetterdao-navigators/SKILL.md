---
name: vebetterdao-navigators
description: "VeBetterDAO Navigators feature: rewards multipliers (freshness + governance intent) and navigator delegation system. Use when working on navigator contracts, delegation, staking, freshness multiplier, governance intent multiplier, navigator fees, slashing, or any navigator-related frontend/backend code. Triggers on: navigator, navigators, delegation, freshness multiplier, governance intent, navigator staking, navigator fee, slashing, NavigatorRegistry."
allowed-tools: []
license: MIT
metadata:
  author: VeChain
  version: "0.4.0"
---

# VeBetterDAO Navigators Feature

Domain knowledge for the Navigators feature: rewards multipliers and navigator delegation system. Both phases ship together in one release.

## Phase 1: Rewards Multipliers

### Freshness Multiplier (Allocation Voting)

Applied in `RoundVotesCountingUtils.countVote()` via `FreshnessUtils` library — modifies reward weight only, NOT on-chain voting power.

| Behavior | Multiplier |
|---|---|
| Updated this round (weekly) | x3 (30000 bp) |
| Updated within 2 rounds (bi-weekly) | x2 (20000 bp) |
| No update for >= 3 rounds | x1 (10000 bp) |

- "Update" = changing the set of apps voted for (adding/removing/swapping). Weight changes between same apps do NOT count
- Computed via XOR fingerprint of voted app IDs (order-independent, O(n), gas-cheap)
- First-time voters always get x3 (detected by `lastFingerprint == bytes32(0)`)
- Governance-configurable via `VoterRewards.setFreshnessMultipliers(tier1, tier2, tier3)`
- Values stored as `Checkpoints.Trace208` in VoterRewards (snapshotted at round start)
- Navigator-delegated citizens **inherit navigator's freshness** (citizen fingerprint updated with navigator's preferences at vote time)

### Governance Intent Multiplier (Proposal Voting)

Applied in `GovernorVotesLogic` before `registerVote()`. Per-proposal at registration time — each proposal independent.

| Vote Type | Multiplier |
|---|---|
| For / Against | x1 (10000 bp) |
| Abstain | x0.30 (3000 bp) |

- Governance-configurable via `VoterRewards.setIntentMultipliers(forAgainst, abstain)`
- Navigator-delegated citizens **inherit navigator's decision multiplier**

### Multiplier scope

- **Freshness** scales reward weight for allocation rewards only (in `RoundVotesCountingUtils.countVote()`)
- **Intent** scales reward weight for governance rewards only (in `GovernorVotesLogic` before `registerVote`)
- **GM is not stacked with freshness/intent.** When the GM pool is funded (v5+ live config), GM accumulates its own separate per-voter weight in `cycleToVoterToGMWeight`, claimed against the GM pool — it does not multiply the allocation/governance reward weight. The legacy `weight * GM` path in `VoterRewards.registerVote()` only runs when `gmPoolAmount == 0`
- Scale: basis points (10000 = 1x)

### Safe upgrade

`VoterRewards.initializeV7` creates two checkpoints per multiplier:
1. At round start timepoint → 10000 (neutral) so current round is unaffected
2. At current block → real configured values (takes effect next round)

## Phase 2: Navigator System

### Core Concepts

- **Navigator**: User who stakes B3TR to vote on behalf of delegating citizens
- **Citizen**: User who delegates specific VOT3 amount to a navigator
- Roles are **mutually exclusive** — navigators cannot be citizens of another navigator
- Citizens retain full VOT3 ownership but **delegated portion is locked**

### Registration

- Permissionless — stake minimum 50,000 B3TR in NavigatorRegistry
- Max stake: 1% of circulating VOT3 (enforced at deposit only, grandfathered)
- 10:1 delegation ratio: stake must be >= 10% of total delegated VOT3. Stake reduction blocked if it would violate ratio
- On-chain metadata URI for profile (same pattern as X2EarnApps)
- On-chain reports optional every round, **mandatory at least once every 2 rounds** via `submitReport(metadataURI)`
- Navigators cannot enable auto-voting (mutually exclusive)
- Navigators cannot delegate to other navigators (mutually exclusive roles)

### Delegation

- Citizens delegate a **specific VOT3 amount** (explicit choice, not full balance), minimum **1 VOT3**
- VOT3 stays in citizen's wallet, but the delegated portion is locked (cannot transfer or convert to B3TR)
- `balanceOf()` returns **full** VOT3 balance (including delegated). Use `unlockedBalance()` for transferable amount
- VOT3 `_update()` enforces: `balance - delegatedAmount >= transferAmount`
- VOT3 reads delegation amounts from NavigatorRegistry via `INavigatorRegistry.getDelegatedAmount(from)` — no role grant, no mapping on VOT3; VOT3 stores only the registry address
- **One navigator per citizen**
- **Snapshotted at round start** — mid-round changes take effect next round
- **Partial undelegation allowed** (takes effect next round)
- **No personhood check to delegate**. Personhood validated at vote time (snapshot); non-person citizens are skipped
- Citizens **cannot vote manually** while delegated — must exit delegation first
- Auto-voting is **disabled** when delegating (NavigatorRegistry calls `XAllocationVoting.disableAutoVotingFor`)
- Non-delegated VOT3 is idle (earns nothing)
- Delegation **rejected** if it would exceed navigator's capacity (10:1 ratio)

### Delegation Functions

| Function | Purpose | Events |
|---|---|---|
| `delegate(navigator, amount)` | First-time only. Auto-clears stale delegation from dead navigator. | `DelegationCreated` |
| `increaseDelegation(amount)` | Add more VOT3 to existing delegation | `DelegationIncreased` |
| `reduceDelegation(amount)` | Partial or full reduction (full = removes delegation) | `DelegationDecreased` or `DelegationRemoved` |
| `undelegate()` | Fully remove delegation | `DelegationRemoved` |

### Global Citizen Count

NavigatorRegistry tracks delegated citizens globally:
- `Checkpoints.Trace208 totalDelegatedCitizens` — incremented on delegate, decremented on undelegate
- `mapping(address => uint256) navigatorCitizenCount` — per-navigator count
- `getTotalDelegatedCitizensAtTimepoint(timepoint)` — used by `XAllocationVoting.startNewRound` to compute `governanceUsers`
- On `announceExit()` / `deactivateNavigator()`: navigatorCitizenCount zeroed and totalDelegatedCitizens decremented immediately

### Voting Mechanics

#### Allocation Voting (XAllocationVoting)

Two separate functions (NOT merged):
- `castVoteOnBehalfOf(voter, roundId)` — existing auto-voting flow (unchanged)
- `castNavigatorVote(citizen, roundId)` — navigator-delegated citizens:
  - Personhood validated at snapshot — non-person citizens are skipped (not reverted), matching `castVoteOnBehalfOf` behavior
  - Voting power = **delegated amount at round snapshot** (checkpointed, NOT full balance)
  - Navigator's app preferences and percentages (custom weight distribution in basis points, must sum to 10000; max 15 apps)
  - Each citizen = separate transaction
  - Includes built-in skip-or-vote logic (see Relayer Integration below)
  - Registers `RelayerAction.VOTE` for the caller

Navigator setting preferences = their own vote (personal VOT3 balance + staked B3TR converted to VOT3)

#### Governance Proposal Voting (B3TRGovernor)

`castNavigatorVote(proposalId, citizen)` — separate function:
1. Citizen must be delegated to a navigator at proposal snapshot
2. Navigator must have set decision (1=Against, 2=For, 3=Abstain)
3. Voting power = **delegated amount at proposal snapshot** (checkpointed)
4. Intent multiplier applied for rewards
5. Registers `RelayerAction.VOTE` in RelayerRewardsPool
6. Includes built-in skip-or-vote logic (see Relayer Integration below)

### getVotes Reflects Delegation

`getVotes(account, timepoint)` on both governors:
- If citizen had a **live** navigator at `timepoint`: returns **delegated amount only** (this is the citizen's voting power)
- If no navigator: returns full `VOT3.getPastVotes` (+ `getDepositVotingPower` in XAllocationVoting)
- Returns full balance when `navigatorRegistry == address(0)` (backwards compatible)
- `getQuadraticVotingPower` calls `getVotes` internally, so delegation cascades to `sqrt(delegated) * 1e9`
- **View-only**: actual `castVote` reverts with `DelegatedToNavigator` if citizen had a navigator at snapshot. Navigator votes use `getDelegatedAmountAtTimepoint` directly

### Relayer Integration

**Citizens counted in relayer expected actions:**
- At round start, `XAllocationVoting.startNewRound` computes:
  - `allocationUsers = autoVotingUsers + totalDelegatedCitizens`
  - `governanceUsers = totalDelegatedCitizens` (citizens only — relayers don't cast governance votes for auto-users)
- Fetches active governance proposals via `B3TRGovernor.getActiveProposals()`
- Passes all to `RelayerRewardsPool.setTotalActionsForRoundWithGovernance(roundId, allocationUsers, governanceUsers, activeProposalIds)`
- Expected actions per round: `allocationUsers * 2` (vote + claim) + `governanceUsers * activeProposals` (governance votes)

**Skip-or-vote flow:**

`castNavigatorVote` (both allocation and governance) merges vote and skip into a single function:

1. Navigator dead at snapshot → revert `NotDelegatedToNavigator` (citizen was never delegated)
2. Citizen not a person at snapshot → skip immediately, reduce expected actions (`NavigatorVoteSkipped` / `NavigatorGovernanceVoteSkipped`)
3. Navigator dead NOW (exited/deactivated after snapshot) → skip immediately, reduce expected actions
4. Navigator alive + preferences/decision set → vote normally
5. Navigator alive + no preferences/decision + **skip window reached** → skip, reduce expected actions
6. Navigator alive + no preferences/decision + skip window NOT reached → revert (relayer retries later)

Skip window = 2 hours (~720 blocks) before round/proposal deadline. Constants: `CITIZEN_SKIP_WINDOW_BLOCKS` (allocation), `GOVERNANCE_SKIP_WINDOW_BLOCKS` (governance).

**Per-user skip tracking (RelayerRewardsPool V3):**
- `reduceUserAllocationVote(roundId, user)` — reduces one allocation vote action for a specific user
- `reduceUserGovernanceVote(roundId, user, proposalId)` — reduces one governance vote action per user/proposal
- When ALL vote actions for a user are skipped (allocation + all governance proposals), the claim action is auto-reduced
- Prevents double-skip: reverts if already reduced for the same user/round/proposal

**Active proposals caching:**
- `B3TRGovernor.proposalsForRound` mapping populated at proposal creation
- `getActiveProposals()` filters by Active state from current round's proposals
- Cached in `RelayerRewardsPool.activeProposalsForRound` at round start

**Late preferences infraction:**
- Navigators must set preferences at least `preferenceCutoffPeriod` blocks (~24hr) before round deadline
- Setting later is allowed, but marks the round as a minor infraction

**Auto-voting disabled on delegation:**
- `NavigatorRegistry.delegate()` calls `XAllocationVoting.disableAutoVotingFor(citizen)` (privileged call)
- On undelegate: user re-enables auto-voting manually

**Preferred relayer:**
- Citizens set `preferredRelayer` manually via `relayerRewardsPool.setPreferredRelayer(relayer)`
- During early access, only the preferred relayer (if set and registered) can act on the citizen's behalf
- **No auto-setting on delegation** — citizens must set it manually

**Fee ordering for citizens (at claim time):**
1. Navigator fee: deducted from gross reward first (goes to NavigatorRegistry fee escrow)
2. Relayer fee: deducted from remainder (goes to RelayerRewardsPool)
3. Citizen receives the rest
- Relayer fee applies to both auto-voters AND citizens
- CLAIM action registered for both

## Rewards

Rewards proportional to **delegated amount at snapshot only** (not full balance). Citizen's own GM level applies.

Fee ordering:
```
1. Navigator fee = gross reward * navigatorFeePercentage / 10000 (goes to NavigatorRegistry escrow)
2. Relayer fee = relayerRewardsPool.calculateRelayerFee(gross - navigatorFee) (goes to RelayerRewardsPool)
3. Citizen receives the rest
```

- Relayer fee applies to both auto-voters AND navigator citizens
- Navigator fee applies to citizens only
- Fee deducted at reward claim time in VoterRewards.claimReward()
- Citizens' freshness fingerprints updated with navigator's app preferences at vote time (inheriting freshness)
- Citizens inherit navigator's governance intent multiplier

## Fee Escrow

Inside NavigatorRegistry: `mapping(navigator => mapping(round => amount))`
- Each round's fees claimable **4 rounds later** (rolling unlock)
- Major slash takes **all unclaimed locked fees**

## Slashing

### Minor (Automatic, 5% of current remaining stake — compounding)

Reportable by anyone via public function. Slashed funds to treasury.

Six infraction types:
1. **Missed allocation vote** — had citizens, didn't set preferences for a round (requires delegations)
2. **Missed governance proposal vote** — had citizens, didn't set decision during proposal's voting period (requires delegations)
3. **Stale allocation preferences** — no update >= 3 rounds (same threshold as freshness multiplier) (requires delegations)
4. **Missed report** — no report submitted in 2 consecutive rounds (requires delegations)
5. **Late preferences** — set allocation preferences after `preferenceCutoffPeriod` (~24hr) before round deadline (requires delegations)
6. **Below minimum stake** — stake was below `minStake` at round snapshot (applies **regardless of delegations**)

Infraction flags (bit flags in `NavigatorSlashingUtils`):
- `FLAG_MISSED_ALLOCATION = 1 << 0` (1)
- `FLAG_LATE_PREFERENCES = 1 << 1` (2)
- `FLAG_STALE_PREFERENCES = 1 << 2` (4)
- `FLAG_MISSED_REPORT = 1 << 3` (8)
- `FLAG_MISSED_GOVERNANCE = 1 << 4` (16)
- `FLAG_BELOW_MIN_STAKE = 1 << 5` (32)

Reporting model:
- Minor reporting is **per round**, not per infraction
- Anyone calls `reportRoundInfractions(navigator, roundId, proposalIds)` after the round ends
- Contract evaluates all six infraction types on-chain for that round
- Infractions 1-5 only checked when navigator had delegations at the round snapshot
- Infraction 6 (below min stake) checked **regardless of delegations** — navigators must maintain their stake above minimum at all times
- If any infraction is true, exactly **one** minor slash is applied for that round
- If round is still active, report reverts with `RoundStillActive`

If stake drops below minimum: stays active but **can't accept new delegations** and **will be slashed** at the end of the round if not resolved.

### Major (Governance process, up to 100% of stake + locked fees + removal)

For: manipulation, bribery, vote buying, undisclosed compensation.
Process: 5 navigators lock stakes to trigger → public findings within 4 rounds → governance vote.

## Deactivation

- Via **governance proposal** (anyone can propose) with on-chain execution
- Proposal includes **slash amount** (0-100% of stake + locked fees)
- Takes effect **next round** (current round completes normally)
- **Cannot reactivate** — must register fresh

## Exit

1. `announceExit()` — event emitted, **1 round notice** (governance-configurable)
2. Navigator must continue voting during notice
3. **Lazy invalidation**: as soon as exit is announced, all citizen delegations become void at the view level
   - `isDelegated()` returns false, `getDelegatedAmount()` returns 0
   - VOT3 transfer lock auto-releases (no citizen action needed)
   - `castNavigatorVote` fails with `NotDelegatedToNavigator`
   - No new citizens can delegate (`NavigatorCannotAcceptDelegations`)
4. Citizens can **directly re-delegate to a new navigator** without calling `undelegate()` first (stale delegation auto-cleared)
5. After exit notice period passes (deactivation checkpoint reached), `withdrawStake()` becomes available — stake returned **immediately**. Locked fees follow their individual 4-round schedules via `claimFee(roundId)`
6. Re-entry = fresh registration
7. **No `finalizeExit()`** — exit is self-enforcing via checkpoint timing

### Citizen experience on navigator exit/deactivation

Citizens don't need to take any action — VOT3 automatically unlocked via lazy invalidation:
- `getDelegatedAmount(citizen)` checks if navigator is dead → returns 0
- VOT3._update() reads `getDelegatedAmount` → sees 0 → transfer allowed
- Citizen can `delegate(newNavigator, amount)` directly — old stale checkpoint auto-cleared
- Historical delegation data preserved for reward calculation (`getDelegatedAmountAtTimepoint` not affected)

### Indexer: implicit delegation removal

No `DelegationRemoved` events emitted when a navigator exits or is deactivated. **Indexers must treat `ExitAnnounced` / `NavigatorDeactivated` events as bulk removal of all citizen delegations for that navigator.**

## Staking and Voting Power

**Navigators stake B3TR, which is converted to VOT3 under the hood.** The staked amount is held by NavigatorRegistry as VOT3 and **counts as the navigator's personal voting power** (checkpointed via `stakedAmount` Trace208). NavigatorRegistry self-delegates on VOT3 during initialization so the total voting supply is accurate.

The staked VOT3 only counts for voting power — it cannot be used to support proposals or powered down. It does not earn direct rewards.

| Actor | Voting power source | What's NOT counted |
|---|---|---|
| Navigator (own vote) | Personal VOT3 balance + staked B3TR (as VOT3) | Delegated VOT3 from citizens |
| Citizen (navigated vote) | Their delegated VOT3 amount at snapshot | Remaining undelegated VOT3 |

Delegated VOT3 never leaves the citizen's wallet. Navigator decides what to vote; each citizen's delegated amount is cast as a separate vote.

**B3TR↔VOT3 conversion flow:** On `register()`/`addStake()`: B3TR transferred to contract → converted to VOT3 via `VOT3.convertToVOT3()`. On `reduceStake()`/`withdrawStake()`/slash: VOT3 converted back to B3TR via `VOT3.convertToB3TR()` → transferred out.

**Economics:** staked B3TR gives the navigator voting power. They must also attract delegation to earn fees. Example: 50K B3TR staked (= 50K VOT3 voting power) → up to 500K VOT3 delegated → navigator earns 20% fee on rewards generated by those 500K VOT3.

## Contract-Level Protections

| Protection | Contract | Error |
|---|---|---|
| Self-delegation blocked | NavigatorDelegationUtils | `SelfDelegationNotAllowed` |
| Delegators can't register as navigator | NavigatorStakingUtils | `DelegatorCannotRegister` |
| Citizens can't manual vote (allocation) | XAllocationVoting | `DelegatedToNavigator` |
| Citizens can't manual vote (governance) | GovernorVotesLogic | `DelegatedToNavigator` |
| Navigators can't enable auto-voting | XAllocationVoting | `NavigatorCannotEnableAutoVoting` |
| Citizens can't enable auto-voting | XAllocationVoting | `DelegatedToNavigator` |
| Fee deposit restricted to VoterRewards | NavigatorRegistry | `UnauthorizedCaller` |
| Lazy invalidation on exit/deactivation | NavigatorDelegationUtils | `_isNavigatorDead()` |

## Key Contracts

### New
- `NavigatorRegistry` — UUPS upgradeable facade with 6 libraries: NavigatorStakingUtils, NavigatorDelegationUtils, NavigatorVotingUtils, NavigatorFeeUtils, NavigatorSlashingUtils, NavigatorLifecycleUtils

### Modified
- `VOT3.sol` (V2) — reads delegation lock from NavigatorRegistry, no duplicate storage
- `XAllocationVoting.sol` (V9) — `castNavigatorVote`, `disableAutoVotingFor`, `startNewRound` with citizens + governance
- `B3TRGovernor.sol` (V10) — `castNavigatorVote`, `getActiveProposals`, `proposalsForRound`, relayerRewardsPool
- `VoterRewards.sol` (V7) — multiplier checkpoints, navigator fee deduction, intent multiplier
- `RelayerRewardsPool.sol` (V3) — per-user skip tracking, `setTotalActionsForRoundWithGovernance`, activeProposalsForRound

### Dependencies (read-only)
- `VOT3.sol` — circulating supply for max stake cap
- `VeBetterPassport` — personhood checks (validated at snapshot for navigated citizens; non-persons skipped)
- `RelayerRewardsPool` — relayer registration check, preferredRelayer, per-user skip tracking
- `B3TRGovernor` — active proposals query at round start

## Codebase Reference

### Navigator contracts
- `/packages/contracts/contracts/navigator/NavigatorRegistry.sol` — main facade
- `/packages/contracts/contracts/navigator/libraries/NavigatorStorageTypes.sol` — single ERC-7201 namespace
- `/packages/contracts/contracts/navigator/libraries/NavigatorStakingUtils.sol`
- `/packages/contracts/contracts/navigator/libraries/NavigatorDelegationUtils.sol`
- `/packages/contracts/contracts/navigator/libraries/NavigatorVotingUtils.sol`
- `/packages/contracts/contracts/navigator/libraries/NavigatorFeeUtils.sol`
- `/packages/contracts/contracts/navigator/libraries/NavigatorSlashingUtils.sol`
- `/packages/contracts/contracts/navigator/libraries/NavigatorLifecycleUtils.sol`
- `/packages/contracts/contracts/interfaces/INavigatorRegistry.sol`

### Modified contracts
- `/packages/contracts/contracts/x-allocation-voting-governance/XAllocationVoting.sol`
- `/packages/contracts/contracts/x-allocation-voting-governance/libraries/VotesUtils.sol`
- `/packages/contracts/contracts/governance/B3TRGovernor.sol`
- `/packages/contracts/contracts/governance/libraries/GovernorVotesLogic.sol`
- `/packages/contracts/contracts/governance/libraries/GovernorStorageTypes.sol`
- `/packages/contracts/contracts/governance/libraries/GovernorConfigurator.sol`
- `/packages/contracts/contracts/VoterRewards.sol`
- `/packages/contracts/contracts/VOT3.sol`
- `/packages/contracts/contracts/RelayerRewardsPool.sol`

## Not in v1

1. Navigator-configurable fee rates (fixed 20%)
