---
name: auto-voting-relayers
description: "Complete domain knowledge for VeBetterDAO's auto-voting and relayer system. Use when working on relayer dashboard, relayer node, auto-voting contracts (XAllocationVoting, VoterRewards, RelayerRewardsPool), or anything related to relayers, auto-voting, gasless voting, or relayer rewards. Triggers on: relayer, auto-voting, autovoting, gasless voting, relayer rewards, RelayerRewardsPool, castVoteOnBehalfOf, castNavigatorVote, relayer dashboard, relayer node, veDelegate comparison."
allowed-tools: []
license: MIT
metadata:
  author: VeChain
  version: "0.2.0"
---

# VeBetterDAO Auto-Voting & Relayer System

Complete domain knowledge for the auto-voting and relayer ecosystem. This skill provides context for working on any component of the system: smart contracts, relayer node, relayer dashboard, or documentation.

## System Overview

VeBetterDAO's auto-voting system lets users automate their weekly X Allocation voting. Users pick favorite apps once, toggle auto-voting on, and relayers (off-chain services) handle the rest: casting votes, claiming rewards, all gasless. Relayers earn a fee from the reward pool. Tokens never leave the user's wallet.

With the Navigators feature, relayers also serve **navigator-delegated citizens** — voting allocation rounds AND governance proposals on their behalf. Citizens are fully counted in expected actions alongside auto-voting users.

## Architecture

```text
Users (toggle auto-voting, set preferences)
Citizens (delegate VOT3 to a navigator)
    |
    v
Smart Contracts (on-chain logic)
    - XAllocationVoting (v9): auto-voting state, vote execution, castNavigatorVote
    - B3TRGovernor (v10): governance castNavigatorVote, getActiveProposals
    - VoterRewards (v7): reward claiming, fee deduction (relayer + navigator fees)
    - RelayerRewardsPool (v3): relayer registration, reward distribution, per-user skip tracking
    - NavigatorRegistry: delegation state, preferences, governance decisions
    |
    v
Relayer Nodes (off-chain execution)
    - relayer-node/ (standalone CLI, no monorepo dependency)
    - Monitor rounds, batch vote/claim, loop every 5 min
    - Serve both auto-voting users and navigator citizens
    |
    v
Relayer Dashboard (monitoring/analytics)
    - apps/relayer-dashboard/ (static Next.js, GitHub Pages)
    - Round analytics, relayer stats, ROI tracking
```

## How It Works (Non-Technical)

### For Users (Auto-Voting)

1. Hold 1+ VOT3, complete 3+ sustainable actions, pass VeBetterPassport
2. Choose up to 15 apps, toggle auto-voting on
3. Takes effect next round (not current)
4. Each week: relayer votes for you, claims your rewards to your wallet
5. Fee: 10% of rewards (max 100 B3TR/week) - covers all gas costs
6. While active: no manual voting/claiming allowed
7. Manual claim fallback: available 5 days after round end if relayer hasn't processed

### For Citizens (Navigator Delegation)

1. Delegate specific VOT3 amount to a navigator
2. Auto-voting is automatically disabled on delegation
3. Relayer votes allocation rounds using navigator's app preferences
4. Relayer votes governance proposals using navigator's decision (For/Against/Abstain)
5. Relayer claims rewards — navigator fee deducted first, then relayer fee
6. Citizen receives remaining reward to wallet

### Auto-Disable Triggers (Auto-Voting)

- VOT3 drops below 1
- All selected apps become ineligible
- Sustainable action threshold not met
- Bot detection by app owner

### For Relayers

1. Register on-chain by calling registerRelayer() on RelayerRewardsPool (open to anyone)
2. Run relayer-node with wallet (MNEMONIC or RELAYER_PRIVATE_KEY)
3. Node auto-discovers auto-voting users AND navigator citizens
4. Earn weighted points: vote = 3 pts, claim = 1 pt (for both auto-voting and citizen votes)
5. Governance votes for citizens also earn vote weight (3 pts each)
6. After ALL expected actions completed (or skipped), claim proportional share of reward pool

### Apps as Relayers

Apps can register as relayers, ask users to set them as preference, and run a node. They earn relayer fees instead of paying veDelegate for votes. Important: apps should ADD themselves to preference lists, not replace other apps.

## vs veDelegate

| Feature | veDelegate | VeBetterDAO Auto-Voting |
| --- | --- | --- |
| X Allocation voting | Yes | Yes |
| Governance voting | Yes (always "abstain") | Yes (citizens: navigator's decision) |
| Compounding (B3TR->VOT3) | Auto | Manual |
| Token custody | Leaves wallet | Stays in wallet |
| Centralization | Single entity | Many relayers |
| Cost to apps | Apps pay veDelegate | Apps earn fees |

veDelegate: docs.vedelegate.vet / github.com/vechain-energy/vedelegate-for-dapps

## Smart Contracts Detail

### XAllocationVoting.sol (v9)

Auto-voting added in v8, navigator voting added in v9. Now uses external library architecture.

**Storage** (in AutoVotingLogic / XAllocationVotingStorageTypes):

- `_autoVotingEnabled`: Checkpointed per-user status (changes take effect next round)
- `_userVotingPreferences`: Array of app IDs per user (max 15, validated, no duplicates)
- `_totalAutoVotingUsers`: Checkpointed total count
- `navigatorRegistry`: INavigatorRegistry reference (V9)

**Key functions:**

```solidity
toggleAutoVoting(address user)                         // Enable/disable
setUserVotingPreferences(bytes32[] memory appIds)      // Set apps (1-15)
castVoteOnBehalfOf(address voter, uint256 roundId)     // Relayer executes auto-vote
castNavigatorVote(address citizen, uint256 roundId)    // Relayer executes citizen vote (vote-or-skip)
disableAutoVotingFor(address user)                     // Privileged, called by NavigatorRegistry on delegation
getUserVotingPreferences(address)                      // View preferences
isUserAutoVotingEnabled(address)                       // Current status
isUserAutoVotingEnabledForRound(address, uint256)      // Status at round snapshot
getTotalAutoVotingUsersAtRoundStart()                  // Count at last emission
getTotalAutoVotingUsersAtTimepoint(uint48)             // Historical count
```

**Vote execution** (`castVoteOnBehalfOf` — auto-voting users):

1. Validate early access (registered relayer during window)
2. Get user preferences, filter eligible apps
3. Split voting power equally across eligible apps
4. Cast via internal `_countVote()`
5. Register VOTE action on RelayerRewardsPool (3 weight points)

**Navigator vote execution** (`castNavigatorVote` — citizens):

Skip-or-vote decision flow (merged into the function, no separate skip call):

1. Navigator dead at snapshot → revert `NotDelegatedToNavigator`
2. Navigator dead NOW (exited/deactivated after snapshot) → skip via `pool.reduceUserAllocationVote`, emit `NavigatorVoteSkipped`
3. Navigator alive + preferences set → vote normally using navigator's custom percentages (basis points, must sum to 10000), register `RelayerAction.VOTE`
4. Navigator alive + no preferences + skip window reached → skip, emit `NavigatorVoteSkipped`
5. Navigator alive + no preferences + skip window NOT reached → revert `SkipWindowNotReached`

Skip window: `CITIZEN_SKIP_WINDOW_BLOCKS = 720` (~2 hours before round deadline)

**`startNewRound()` — expected actions setup:**

Computes expected actions for the round:
- `allocationUsers = autoVotingUsers + totalDelegatedCitizens`
- `governanceUsers = totalDelegatedCitizens` (citizens only — relayers don't cast governance for auto-users)
- Fetches `governor.getActiveProposals()`
- Calls `pool.setTotalActionsForRoundWithGovernance(roundId, allocationUsers, governanceUsers, activeProposals)`

### B3TRGovernor.sol (v10)

V10 added navigator governance voting and relayer integration.

**`castNavigatorVote(proposalId, citizen)` — citizens governance vote:**

Same skip-or-vote pattern as XAllocationVoting:

1. Navigator dead at snapshot → revert `NotDelegatedToNavigator`
2. Navigator dead NOW → skip via `pool.reduceUserGovernanceVote`, emit `NavigatorGovernanceVoteSkipped`
3. Navigator alive + decision set → vote normally, register `RelayerAction.VOTE` in RelayerRewardsPool
4. Navigator alive + no decision + skip window reached → skip, emit `NavigatorGovernanceVoteSkipped`
5. Navigator alive + no decision + skip window NOT reached → revert `GovernanceSkipWindowNotReached`

Skip window: `GOVERNANCE_SKIP_WINDOW_BLOCKS = 720` (~2 hours before proposal deadline)

Maps navigator decision: 1=Against, 2=For, 3=Abstain → governor support 0, 1, 2.
Applies intent multiplier for rewards.

**`getActiveProposals()`** — returns currently active proposal IDs (filtered from `proposalsForRound` mapping, populated at proposal creation time). Used by `XAllocationVoting.startNewRound` to compute governance expected actions.

### VoterRewards.sol (v7)

V6 added relayer fee integration. V7 added navigator fee deduction and rewards multipliers.

**V7 storage additions:** `navigatorRegistry`

**Fee flow in `claimReward(uint256 cycle, address voter)`:**

1. Check user had auto-voting OR delegation at round start (checkpointed)
2. Calculate raw rewards (voting + GM reward)
3. If citizen (delegated): deduct navigator fee first from gross reward → deposit to NavigatorRegistry fee escrow
4. If auto-voting OR delegated: deduct relayer fee from remainder → `RelayerRewardsPool.deposit(fee, cycle)`
5. `registerRelayerAction(msg.sender, voter, cycle, CLAIM)` — credits caller with 1 weight point
6. Net reward transferred to voter wallet

**Fee formula:**
```
Navigator fee = gross * navigatorFeePercentage / 10000 (citizens only, goes to NavigatorRegistry escrow)
Relayer fee = min((gross - navigatorFee) * relayerFeePercentage / 100, feeCap) (auto-voters AND citizens)
```

**Important:** `msg.sender` calling `claimReward()` IS the relayer credited for CLAIM action.

**Early access:** During window, reverts if caller is the voter or not a registered relayer. Applies to both auto-voters and citizens.

### RelayerRewardsPool.sol (v3)

Manages registration, action tracking, reward distribution, per-user skip tracking.

**Core storage:**

```text
totalRewards[roundId]                    // Pool amount (funded by fees)
relayerWeightedActions[roundId][relayer] // Per-relayer weighted work
totalWeightedActions[roundId]            // Expected weighted total
completedWeightedActions[roundId]        // Completed weighted total
registeredRelayers[address]              // Registration mapping
relayerAddresses[]                       // All registered addresses
voteWeight = 3                           // Points per vote action
claimWeight = 1                          // Points per claim action
earlyAccessBlocks = 432,000              // ~5 days on VeChain
relayerFeePercentage = 10               // 10%
feeCap = 100 ether                       // 100 B3TR
```

**V3 storage additions:**

```text
activeProposalsForRound[roundId]                      // Cached governance proposal IDs
userAllocationVoteReduced[roundId][user]               // Per-user allocation skip flag
userGovernanceVoteReduced[roundId][user][proposalId]   // Per-user/proposal governance skip flag
userClaimReduced[roundId][user]                        // Per-user claim auto-reduction flag
```

**Reward formula:**

```text
relayerShare = (relayerWeightedActions / completedWeightedActions) * totalRewards
```

**Claimability:** `isRewardClaimable(roundId)` requires:

- Round ended (`emissions.isCycleEnded(roundId)`)
- All work done (`completedWeightedActions >= totalWeightedActions`)
- Per-user skips auto-reduce totalWeightedActions, so skipped citizens don't block claimability

**Registration (open to anyone):**

- `registerRelayer()` — self-registration
- `unregisterRelayer(address)` — callable by admin or the relayer itself

**Expected actions setup:**

- `setTotalActionsForRound(roundId, userCount)` — legacy, delegates to `setTotalActionsForRoundWithGovernance` with governanceUsers=0
- `setTotalActionsForRoundWithGovernance(roundId, allocationUsers, governanceUsers, activeProposalIds)` — V3: sets expected actions. Total = `allocationUsers * 2` (vote+claim) + `governanceUsers * activeProposals` (governance votes). Caches activeProposalIds

**Action reduction:**

- `reduceExpectedActionsForRound(roundId, userCount)` — bulk reduction for ineligible auto-voting users
- `reduceUserAllocationVote(roundId, user)` — per-user allocation skip. If all votes for user are skipped, auto-reduces claim
- `reduceUserGovernanceVote(roundId, user, proposalId)` — per-user/proposal governance skip. Same auto-reduce logic
- Double-skip prevention: reverts if already reduced for same user/round/proposal

**Action registration:**

- `registerRelayerAction(relayer, voter, roundId, action)` — records vote or claim work
- `deposit(amount, roundId)` — funds pool from fee deductions

**Early access:**

- Vote window: `roundSnapshot + earlyAccessBlocks`
- Claim window: `roundDeadline + earlyAccessBlocks`
- During: only registered relayers, user can't self-act
- After: anyone can act

## Relayer Lifecycle (Per Round)

```text
Round N: Users enable auto-voting / citizens delegate to navigators (checkpointed)
Round N+1:
  1. startNewRound() - snapshot locks status
     - allocationUsers = autoVotingUsers + totalDelegatedCitizens
     - governanceUsers = totalDelegatedCitizens
     - fetches activeProposals from B3TRGovernor
     - calls setTotalActionsForRoundWithGovernance(roundId, allocationUsers, governanceUsers, activeProposals)

  2. ALLOCATION VOTING:
     a. Relayers call castVoteOnBehalfOf(voter, roundId) for auto-voting users
        - Ineligible users: reduceExpectedActionsForRound()
        - Each successful vote: +3 weighted points
     b. Relayers call castNavigatorVote(citizen, roundId) for citizens
        - Navigator dead/no-prefs + skip window reached: skip (reduceUserAllocationVote)
        - Navigator alive + prefs set: vote, +3 weighted points

  3. GOVERNANCE VOTING (concurrent with allocation):
     For each active proposal:
       Relayers call B3TRGovernor.castNavigatorVote(proposalId, citizen) for each citizen
       - Navigator dead/no-decision + skip window reached: skip (reduceUserGovernanceVote)
       - Navigator alive + decision set: vote, +3 weighted points

  4. Round ends (deadline block)

  5. CLAIMS:
     Relayers call VoterRewards.claimReward(cycle, user) for auto-voters and citizens
     - Navigator fee deducted first (citizens only), then relayer fee
     - Each successful claim: +1 weighted point
     - If all votes for a citizen were skipped, claim is auto-reduced (no claim needed)

  6. All expected actions completed (or reduced via skips) -> pool unlocks
  7. Relayers call RelayerRewardsPool.claimRewards(roundId)
```

## Navigator Citizen Integration

Relayers serve navigator-delegated citizens **in addition to** auto-voting users. This is ADDITIVE on top of existing auto-voting logic.

### Key differences from auto-voting

| Aspect | Auto-Voting Users | Navigator Citizens |
| --- | --- | --- |
| Vote function (allocation) | `castVoteOnBehalfOf(voter, roundId)` | `castNavigatorVote(citizen, roundId)` |
| Vote function (governance) | N/A | `B3TRGovernor.castNavigatorVote(proposalId, citizen)` |
| Discovery | `AutoVotingToggled` events | `DelegationCreated/Removed` events |
| Preferences | User's own app list (equal split) | Navigator's `AllocationPreferencesSet` (custom %) |
| Governance | Not applicable | Navigator's `GovernanceDecisionSet` |
| Voting power | Full VOT3 balance at snapshot | Delegated amount at snapshot (checkpointed) |
| Personhood check | Yes | No |
| In expected actions? | Yes (allocation only) | Yes (allocation + governance) |
| Skip mechanism | `reduceExpectedActionsForRound` (bulk) | Per-user skip with skip window |
| Claim function | `claimReward(cycle, voter)` | Same — `claimReward(cycle, citizen)` |
| Fees at claim | Relayer fee only | Navigator fee first, then relayer fee |

### Citizens in expected actions

Citizens ARE counted in expected actions. At round start:
- `allocationUsers = autoVotingUsers + totalDelegatedCitizens` (for allocation vote + claim)
- `governanceUsers = totalDelegatedCitizens` (for governance votes — citizens only, NOT auto-voters)
- `governanceUsers` is separate because relayers don't cast governance votes for auto-voting users

The **skip window** (720 blocks / ~2 hours before deadline) + **per-user skip tracking** prevent deadlock: if a navigator fails to set preferences, relayers can skip that citizen's votes once the skip window opens, reducing expected actions proportionally.

### Skip-or-vote flow (both allocation and governance)

`castNavigatorVote` handles vote and skip in a single function:

1. Navigator dead at snapshot → revert (citizen not delegated at snapshot)
2. Navigator dead NOW (exited/deactivated since snapshot) → skip immediately, reduce expected actions
3. Navigator alive + preferences/decision set → vote normally
4. Navigator alive + no preferences/decision + skip window reached → skip
5. Navigator alive + no preferences/decision + skip window NOT reached → revert `SkipWindowNotReached` / `GovernanceSkipWindowNotReached` (relayer retries later)

### Per-user skip tracking

When a citizen's vote is skipped:
- Allocation: `reduceUserAllocationVote(roundId, citizen)` — decrements expected actions
- Governance: `reduceUserGovernanceVote(roundId, citizen, proposalId)` — per-proposal decrement
- When ALL votes for a citizen are skipped (allocation + all governance proposals), the claim action is auto-reduced
- Each skip is per-user, per-round, per-proposal — prevents double-reduction

### Governance vote registration

`B3TRGovernor.castNavigatorVote` registers `RelayerAction.VOTE` in RelayerRewardsPool for each governance vote. Relayers earn the same 3 weight points per governance vote as per allocation vote.

### Fee ordering for citizens

1. Navigator fee: deducted from gross reward (goes to NavigatorRegistry fee escrow)
2. Relayer fee: deducted from remainder (same % and cap as auto-voting, goes to RelayerRewardsPool)
3. Citizen receives the rest

### Auto-voting disabled on delegation

When a user delegates to a navigator, their auto-voting is automatically disabled via `XAllocationVoting.disableAutoVotingFor(citizen)`. Prevents double-counting and conflicting vote paths. On undelegate, user must re-enable auto-voting manually.

### Preferred relayer

- Citizens set `preferredRelayer` manually via `relayerRewardsPool.setPreferredRelayer(relayer)`
- During early access, only the preferred relayer (if set and registered) can act on the citizen's behalf
- **No auto-setting on delegation** — citizens must set it manually
- Citizens can override or clear anytime

## Relayer Node (relayer-node/)

Standalone CLI tool. No monorepo dependency.

**Deps:** `@vechain/sdk-core`, `@vechain/sdk-network`, `@vechain/vebetterdao-contracts`

```text
relayer-node/src/
  index.ts      # Entry, env parsing, main loop, SIGINT
  config.ts     # Mainnet + testnet-staging addresses
  contracts.ts  # 26 view functions + event pagination
  relayer.ts    # Batch vote/claim with isolation/retry
  display.ts    # Terminal UI (box drawing + chalk)
  types.ts      # Shared interfaces
```

**Env vars:** `MNEMONIC` / `RELAYER_PRIVATE_KEY`, `RELAYER_NETWORK`, `RUN_ONCE`, `DRY_RUN`

**Cycle:** Discover users from events -> filter voted -> batch castVoteOnBehalfOf + castNavigatorVote -> batch governance castNavigatorVote -> batch claimReward -> loop 5min

## Relayer Dashboard (apps/relayer-dashboard/)

Static Next.js 14 (output: "export"), Chakra UI v3, VeChain Kit, Recharts. GitHub Pages under /b3tr.

**Data:** Static `report.json` (hourly GH Action, temporary) + on-chain reads via `useCallClause`

**Pages** (state-based nav, not file routing):

- Home: StatsCards (2x2), RoundsChart, RoundsList, info cards
- My Relayer: ConnectedWallet view
- Info: BecomeRelayer + AppsAsRelayers
- Round detail: `/round?roundId=X` - 2-col layout, summary/actions/financials

**Hooks:**

- `contracts.ts` - ABIs + addresses from `@repo/config`
- `useCurrentRoundId` - XAllocationVoting.currentRoundId()
- `useTotalAutoVotingUsers` - getTotalAutoVotingUsersAtTimepoint()
- `useRegisteredRelayers` - getRegisteredRelayers()
- `useRoundRewardStatus` - isRewardClaimable() + getTotalRewards()
- `useReportData` - fetches /data/report.json
- `useB3trToVthoRate` - oracle exchange rate

**Commands:** `yarn relayer:dev:staging`, `yarn relayer:dev:mainnet`, `yarn relayer:build:staging`, `yarn relayer:build:mainnet`

## Gas Cost Analysis

| Action | Gas | VTHO | B3TR equiv |
| --- | --- | --- | --- |
| Vote (5-8 apps) | ~441K | ~4.41 | ~0.075 |
| Claim | ~208K | ~2.08 | ~0.035 |
| **Total/user/round** | | **~6.49** | **~0.11** |

Average user: ~10.8k-22.6k VOT3, earns ~90-190 B3TR/round.
At 10% fee: ~9-19 B3TR per user into pool. Relayer cost: ~0.11 B3TR. Margin: ~8.9-18.9 B3TR/user.

## External Resources

- Docs: https://docs.vebetterdao.org/vebetter/automation
- Governance proposal: https://governance.vebetterdao.org/proposals/93450486232994296830196736391400835825360450263361422145364815974754963306849
- Discourse: https://vechain.discourse.group/t/vebetterdao-proposal-auto-voting-for-x-allocation-with-gasless-voting-and-relayer-rewards/559
- NPM: `@vechain/vebetterdao-contracts`
- Contracts source: https://github.com/vechain/vebetterdao-contracts
