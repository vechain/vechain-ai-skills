# VeBetterDAO Smart Contracts Reference

## When to use

Use when the user asks about: VeBetterDAO contract functions, roles, events, contract interactions, emissions, allocation pools, voter rewards, Galaxy Member, Treasury, grants, relayer rewards, DBA pool, X2EarnApps, VeBetterPassport, endorsement, or signaling.

Full source: [github.com/vechain/vebetterdao-contracts](https://github.com/vechain/vebetterdao-contracts)
Auto-generated docs: [vechain.github.io/vebetterdao-contracts](https://vechain.github.io/vebetterdao-contracts/)

---

## Contract Map

```
Emissions ──distribute()──> XAllocationPool + VoterRewards + Treasury + GalaxyMember
                                  │                 │
                    claim()       │    registerVote()│    claimReward()
                         ▼        │                 ▼
               X2EarnRewardsPool  │          VoterRewards
                    │             │                 │
   distributeReward()             │         claimReward()
                    ▼             │                 ▼
               Users (B3TR)       │          Voters (B3TR)
                                  │
                    XAllocationVoting ◄── VOT3 holders vote
                                  │
                    B3TRGovernor ──queue()──> TimeLock ──execute()──> Treasury
```

All upgradeable contracts use **UUPS proxy pattern** with ERC-7201 storage layout.

---

## B3TR (ERC-20 Token)

Capped ERC-20 token. 1B total supply over 12 years.

| Role | Can |
|------|-----|
| `MINTER_ROLE` | `mint(address, amount)` — respects supply cap |
| Admin | `pause()` / `unpause()` — halts all transfers |

Key function: `tokenDetails()` — returns name, symbol, decimals, totalSupply, cap in one call.

## VOT3 (Governance Token)

ERC-20 with voting power. Obtained by converting B3TR 1:1.

| Function | Description |
|----------|-------------|
| `convertToVOT3(amount)` | Swap B3TR → VOT3 |
| `convertToB3TR(amount)` | Burn VOT3 → get B3TR back |
| `delegate(delegatee)` | Delegate voting power (auto-delegates on first receive) |
| `getQuadraticVotingPower(account)` | Square root of token balance |
| `getPastQuadraticVotingPower(account, timepoint)` | Historical voting power |

Roles: `UPGRADER_ROLE`, `PAUSER_ROLE`.

## Emissions

Manages periodic B3TR distribution across XAllocations, Vote2Earn, Treasury, and GM pool with cycle-based decay.

| Function | Description |
|----------|-------------|
| `distribute()` | Distributes tokens for current cycle |
| `getCurrentCycle()` | Current cycle number |
| `getXAllocationAmount(cycle)` | XAllocation amount for cycle |
| `getVote2EarnAmount(cycle)` | Vote2Earn amount for cycle |
| `isCycleDistributed(cycle)` | Whether cycle was distributed |
| `setCycleDuration()` | Set cycle length |
| `setXAllocationsDecay()` / `setVote2EarnDecay()` | Configure decay rates |
| `setTreasuryPercentage()` / `setGmPercentage()` | Adjust allocation splits |

| Role | Can |
|------|-----|
| `MINTER_ROLE` | Initiate distributions |
| `DECAY_SETTINGS_MANAGER_ROLE` | Modify decay parameters |
| `CONTRACTS_ADDRESS_MANAGER_ROLE` | Update external addresses |

## XAllocationVoting

Periodic voting rounds for allocating funds to X2Earn apps. Uses quadratic funding with VOT3 voting power at round start.

| Function | Description |
|----------|-------------|
| `startNewRound()` | Initiate new allocation round |
| `castVote(roundId, appIds, voteWeights)` | Vote on apps (weights must exceed threshold) |
| `toggleAutoVoting(address)` | Enable/disable auto-voting with preset preferences |
| `setUserVotingPreferences(appIds)` | Store preferred app IDs for auto-voting |
| `setVotingPeriod()` | Configure round duration |
| `setAppSharesCap()` | Max % any single app can receive |
| `setBaseAllocationPercentage()` | Minimum base allocation % |
| `updateQuorumNumerator()` | Adjust quorum threshold |

| Role | Can |
|------|-----|
| `ROUND_STARTER_ROLE` | Start new rounds |
| `GOVERNANCE_ROLE` | Governance operations |

Integrates with: X2EarnApps, VoterRewards, Emissions, VeBetterPassport.

## XAllocationPool

Distributes weekly B3TR emissions to X2Earn apps based on voting results. Apps claim at round end.

| Function | Description |
|----------|-------------|
| `claim(roundId, appId)` | App claims earned B3TR for a round |
| `claimableAmount(roundId, appId)` | Returns allocation breakdown (total, unallocated, team, user pool) |
| `roundEarnings(roundId, appId)` | Calculates allocations from base + variable with per-app caps |
| `getAppShares(roundId, appId)` | Voting percentage (capped) |
| `toggleQuadraticFunding()` | Enable/disable quadratic funding for next round |

Unallocated amounts (apps that didn't claim, rounding remainders) are sent to Treasury.

## X2EarnRewardsPool

Reward pool for X2Earn apps to distribute B3TR to users for sustainable actions.

| Function | Description |
|----------|-------------|
| `deposit(amount, appId)` | Fund rewards pool for an app |
| `withdraw(amount, appId, reason)` | Admin withdrawal to team wallet |
| `distributeReward(appId, amount, receiver)` | Basic reward distribution |
| `distributeRewardWithProof(appId, amount, receiver, proofTypes, proofValues, impactCodes, impactValues, description)` | Distribution with impact tracking |
| `distributeRewardWithProofAndMetadata(...)` | Distribution with additional JSON metadata |
| `toggleRewardsPoolBalance(appId, enable)` | Enable/disable rewards pool for app |
| `pauseDistribution()` / `unpauseDistribution()` | Admin pause |
| `addImpactKey()` / `removeImpactKey()` | Manage allowed impact categories |

| Role | Can |
|------|-----|
| `IMPACT_KEY_MANAGER_ROLE` | Manage impact keys |
| `CONTRACTS_ADDRESS_MANAGER_ROLE` | Configuration |

Storage maps app IDs to: available funds, rewards pool balances, enabled status, pause state.

## X2EarnApps

Manages X2Earn application lifecycle: submission, endorsement, eligibility, admins/moderators/creators, reward distributors, and metadata.

**App submission & management:**

| Function | Description |
|----------|-------------|
| `submitApp(teamWallet, admin, appName, metadataURI)` | Submit new app (one per creator NFT holder) |
| `hashAppName(appName)` | Get app ID from name |
| `app(appId)` / `apps()` | Get app details |
| `allEligibleApps()` | All apps eligible for voting |
| `setVotingEligibility(appId, bool)` | Toggle voting eligibility |
| `setAppAdmin(appId, newAdmin)` | Change app admin |
| `updateTeamWalletAddress(appId, addr)` | Update team wallet |
| `setTeamAllocationPercentage(appId, pct)` | Set team allocation % |
| `updateAppMetadata(appId, metadataURI)` | Update IPFS metadata |
| `addAppModerator()` / `removeAppModerator()` | Manage moderators (max `MAX_MODERATORS`) |
| `addRewardDistributor()` / `removeRewardDistributor()` | Manage reward distributors (max `MAX_REWARD_DISTRIBUTORS`) |
| `addCreator()` / `removeAppCreator()` | Manage creators (max `MAX_CREATORS`) |
| `removeXAppSubmission(appId)` | Remove app submission (admin) |

**Endorsement system (V8 — flexible, partial points):**

| Function | Description |
|----------|-------------|
| `endorseApp(appId, nodeId, points)` | Endorse with Stargate node (max 49 pts per app per node, 110 total per app) |
| `unendorseApp(appId, nodeId, points)` | Remove endorsement points (0 = remove all) |
| `checkEndorsement(appId)` | Check if threshold met |
| `getScore(appId)` / `getScoreAtTimepoint(appId, block)` | Current / historical endorsement score |
| `getEndorsers(appId)` / `getEndorserNodes(appId)` | List endorsers |
| `getNodeAvailablePoints(nodeId)` | Remaining points for a node |
| `getNodeActiveEndorsements(nodeId)` | All active endorsements for a node |
| `canUnendorse(nodeId, appId)` | Check cooldown |
| `endorsementScoreThreshold()` | Required score (default 100) |
| `maxPointsPerNodePerApp()` / `maxPointsPerApp()` | Configurable caps |

**Query helpers:** `isEligible(appId, timepoint)`, `isEligibleNow(appId)`, `isBlacklisted(appId)`, `isAppUnendorsed(appId)`, `isAppAdmin(appId, addr)`, `isAppModerator(appId, addr)`, `isRewardDistributor(appId, addr)`, `isCreatorOfAnyApp(addr)`, `gracePeriod()`, `cooldownPeriod()`.

| Role | Can |
|------|-----|
| `GOVERNANCE_ROLE` | Manage settings, eligibility, endorsement config |
| `MIGRATION_ROLE` | Seed endorsements during migration |
| `UPGRADER_ROLE` | Upgrade contract |

Limits: `MAX_MODERATORS`, `MAX_REWARD_DISTRIBUTORS`, `MAX_CREATORS` per app.

## X2EarnCreator (NFT)

Non-transferable ERC-721 for VeBetterDAO creators. One per address.

| Function | Description |
|----------|-------------|
| `safeMint(address)` | Mint to recipient (MINTER_ROLE) |
| `selfMint()` | Self-mint when enabled |
| `burn(tokenId)` | Remove token (BURNER_ROLE) |

Blocks all transfers (`transferFrom` reverts). Roles: `MINTER_ROLE`, `BURNER_ROLE`, `PAUSER_ROLE`.

## B3TRGovernor

Main governance contract. Community creates proposals, deposits VOT3, votes with quadratic voting, and executes through TimeLock.

| Function | Description |
|----------|-------------|
| `propose(...)` | Create proposal with deposit requirement and start round |
| `deposit(proposalId, amount)` | Contribute VOT3 to activate proposal |
| `castVote(proposalId, support)` | Vote: 0=against, 1=for, 2=abstain |
| `castVoteWithReason(proposalId, support, reason)` | Vote with reason string |
| `queue(proposalId)` | Prepare approved proposal for execution |
| `execute(proposalId)` | Execute via TimeLock |
| `cancel(proposalId)` | Cancel proposal |
| `withdraw(proposalId)` | Recover deposits after voting |
| `getQuadraticVotingPower(account, timepoint)` | Quadratic voting power |
| `toggleQuadraticVoting(roundId)` | Enable/disable per round |

Proposal types: `STANDARD` (0) and `GRANT` (1) with type-specific thresholds.

| Role | Can |
|------|-----|
| `GOVERNOR_FUNCTIONS_SETTINGS_ROLE` | Whitelist callable functions |
| `PROPOSAL_EXECUTOR_ROLE` | Execute proposals |
| `PROPOSAL_STATE_MANAGER_ROLE` | Track proposal development |
| `PAUSER_ROLE` | Pause contract |

Integrates with VeBetterPassport for voter identity verification.

## VoterRewards

Calculates and distributes rewards to voters based on voting power and Galaxy Member NFT levels.

| Function | Description |
|----------|-------------|
| `registerVote(voter, votingPower, roundId)` | Records vote with quadratic-weight calculation |
| `claimReward(cycle, voter)` | Claim cycle-specific rewards |
| `getReward(cycle, voter)` | View base reward amount |
| `getGMReward(cycle, voter)` | View GM bonus reward |
| `getRelayerFee(cycle, voter)` | Relayer fee for auto-voting claims |
| `setLevelToMultiplier(level, multiplier)` | Queue multiplier change for next cycle |
| `setLevelToMultiplierNow(level, multiplier)` | Apply multiplier immediately |
| `toggleQuadraticRewarding(cycle)` | Enable/disable quadratic rewarding |

| Role | Can |
|------|-----|
| `VOTE_REGISTRAR_ROLE` | Register votes |
| `DEFAULT_ADMIN_ROLE` | Set multipliers, scaling |

Separate GM rewards pool (v5+). Relayer fee integration (v6).

## GalaxyMember (NFT)

ERC-721 with level progression, node attachment, and voting rewards multiplier.

| Function | Description |
|----------|-------------|
| `freeMint()` | Mint level 1 if user participated in governance |
| `upgrade(tokenId)` | Advance level by paying B3TR |
| `select(tokenId)` | Select token for voting rewards multiplier |
| `selectFor(address, tokenId)` | Admin selects for user |
| `attachNode(tokenId, nodeId)` | Attach Stargate NFT for bonus level |
| `detachNode(tokenId, nodeId)` | Remove attached node |
| `setMaxLevel(level)` | Set maximum upgrade level |
| `setB3TRtoUpgradeToLevel(costs)` | Define B3TR cost per level |

| Role | Can |
|------|-----|
| `MINTER_ROLE` | Minting |
| `PAUSER_ROLE` | Pause/unpause |
| `NODES_MANAGER_ROLE` | Node settings |

V6 replaced node management with Stargate NFT integration.

## Treasury

Manages DAO assets. Receives emissions + unallocated funds.

| Function | Description |
|----------|-------------|
| `transferB3TR(to, amount)` | Transfer B3TR |
| `transferVOT3(to, amount)` | Transfer VOT3 |
| `transferVET(to, amount)` | Transfer VET |
| `transferVTHO(to, amount)` | Transfer VTHO |
| `transferTokens(token, to, amount)` | Generic ERC-20 transfer (with limits) |
| `transferNFT(collection, to, tokenId)` | ERC-721 transfer |
| `convertB3TR(amount)` | B3TR → VOT3 |
| `convertVOT3(amount)` | VOT3 → B3TR |
| `setTransferLimitVET(limit)` | Set VET transfer cap |
| `setTransferLimitToken(token, limit)` | Set per-token transfer cap |

All transfers require `GOVERNANCE_ROLE` and contract must be unpaused.

## TimeLock

Executes governance actions from B3TRGovernor with a mandatory time delay. B3TRGovernor should be the sole proposer and executor.

## RelayerRewardsPool

Manages rewards for relayers performing auto-voting on behalf of users.

| Function | Description |
|----------|-------------|
| `claimRewards(roundId, relayer)` | Claim earned rewards |
| `deposit(amount, roundId)` | Fund the pool |
| `registerRelayerAction(relayer, voter, roundId, action)` | Log vote/claim action |
| `calculateRelayerFee(totalReward)` | Compute fee deduction |
| `setVoteWeight()` / `setClaimWeight()` | Adjust action weights |
| `setRelayerFeePercentage()` / `setFeeCap()` | Configure fee structure |
| `setEarlyAccessBlocks()` | Define early access window |
| `registerRelayer(relayer)` / `unregisterRelayer(relayer)` | Manage relayer access |

| Role | Can |
|------|-----|
| `POOL_ADMIN_ROLE` | Pool administration, relayer management |

## GrantsManager

Milestone-based grant distribution.

| Function | Description |
|----------|-------------|
| `createMilestones(proposalId, milestones)` | Create milestones with IPFS metadata |
| `approveMilestones(proposalId)` | Validate milestone completion |
| `rejectMilestones(proposalId)` | Deny milestones |
| `claimMilestone(proposalId, milestoneIndex)` | Distribute funds for approved milestone |
| `grantState(proposalId)` | Returns: rejected / in development / completed |

| Role | Can |
|------|-----|
| `GRANTS_APPROVER_ROLE` | Approve milestones |
| `GRANTS_REJECTOR_ROLE` | Reject milestones |
| `GOVERNANCE_ROLE` | Protocol governance |

## DBAPool (Dynamic Base Allocation)

Distributes surplus B3TR from XAllocationPool to eligible apps using merit-capped flat distribution.

| Function | Description |
|----------|-------------|
| `distributeDBARewards(roundId, appIds)` | Split pool evenly across apps; cap at 2x vote allocation; overflow to treasury |
| `dbaRoundRewardsForApp(roundId, appId)` | Reward amount for app/round |
| `canDistributeDBARewards(roundId)` | Check distribution eligibility |

Role: `DISTRIBUTOR_ROLE`.

## B3TRMultiSig

Multi-signature wallet requiring multiple owner confirmations (max 50 owners).

| Function | Description |
|----------|-------------|
| `submitTransaction(to, value, data)` | Create pending transaction |
| `confirmTransaction(txId)` | Owner approves |
| `executeTransaction(txId)` | Execute when threshold met |
| `revokeConfirmation(txId)` | Withdraw approval |
| `addOwner(owner)` / `removeOwner(owner)` | Manage owners |
| `changeRequirement(count)` | Adjust confirmation threshold |

## VeBetterPassport

Sybil resistance contract. Determines if a wallet is a real person based on participation score, blacklisting, GM holdings, and entity linking. Used by XAllocationVoting and B3TRGovernor for voter eligibility.

**Core identity checks:**

| Function | Description |
|----------|-------------|
| `isPerson(user)` | Returns `(bool person, string reason)` — checks score, blacklist, GM level |
| `isPersonAtTimepoint(user, timepoint)` | Same check at a specific block |
| `isCheckEnabled(checkType)` | Whether a specific check is active |
| `isWhitelisted(user)` / `isBlacklisted(user)` | Direct status |
| `isPassportWhitelisted(passport)` / `isPassportBlacklisted(passport)` | Checks linked entities too |

**Participation scoring:**

| Function | Description |
|----------|-------------|
| `registerAction(user, appId)` | Register sustainable action (called by apps) |
| `registerActionForRound(user, appId, round)` | Register for specific round |
| `userRoundScore(user, round)` | Score in a specific round |
| `userTotalScore(user)` | Lifetime score |
| `userRoundScoreApp(user, round, appId)` | Per-app per-round score |
| `getCumulativeScoreWithDecay(user, lastRound)` | Decayed cumulative score: `f(t) = a * (1-r)^t` |
| `thresholdPoPScore()` | Required score to be considered a person |
| `appSecurity(appId)` | App security level: `LOW` / `MEDIUM` / `HIGH` |
| `securityMultiplier(security)` | Score multiplier per security level |

**Entity linking** (link multiple wallets to one passport):

| Function | Description |
|----------|-------------|
| `linkEntityToPassport(passport)` | Request linking (entity calls) |
| `acceptEntityLink(entity)` | Passport accepts link |
| `removeEntityLink(entity)` | Remove link (either side) |
| `getPassportForEntity(entity)` | Resolve entity → passport |
| `getEntitiesLinkedToPassport(passport)` | All linked entities |
| `isEntity(user)` / `isPassport(user)` | Check role |
| `maxEntitiesPerPassport()` | Configurable cap |

**Delegation** (delegate personhood to another address):

| Function | Description |
|----------|-------------|
| `delegatePassport(delegatee)` | Request delegation |
| `acceptDelegation(delegator)` | Accept delegation |
| `revokeDelegation()` | Revoke (either side) |
| `getDelegatee(delegator)` / `getDelegator(delegatee)` | Resolve |

**Signaling** (flag suspicious users):

| Function | Description |
|----------|-------------|
| `signalUser(user)` | Signal a user (DEFAULT_ADMIN_ROLE) |
| `signalUserWithReason(user, reason)` | Signal with reason (SIGNALER_ROLE) |
| `resetUserSignalsWithReason(user, reason)` | Reset signals (RESET_SIGNALER_ROLE) |
| `assignSignalerToApp(appId, user)` | Assign app-specific signaler |
| `signaledCounter(user)` | Times user was signaled |
| `signalingThreshold()` | Threshold for auto-blacklist |

| Role | Can |
|------|-----|
| `SETTINGS_MANAGER_ROLE` | Configure thresholds, decay, security |
| `WHITELISTER_ROLE` | Whitelist/blacklist users |
| `ACTION_REGISTRAR_ROLE` | Register actions |
| `ACTION_SCORE_MANAGER_ROLE` | Manage scoring |
| `SIGNALER_ROLE` | Signal users with reason |
| `RESET_SIGNALER_ROLE` | Reset user signals |
| `ROLE_GRANTER` | Grant roles |

## B3TRProxy

EIP-1967 upgradeable proxy. Delegates all calls to the current implementation address. Read implementation via storage slot `0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc`.
