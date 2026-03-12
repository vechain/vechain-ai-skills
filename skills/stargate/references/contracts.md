# StarGate Smart Contracts

## When to use

Use when the user asks about:

- Stargate contract functions, roles, or architecture
- StargateNFT minting, burning, boosting, maturity, token managers
- ProtocolStaker delegation and validator interactions
- Delegation status, rewards claiming, effective stake
- Contract integration for staking flows

## Contract Map

```text
User
 │
 ▼
Stargate (main entry point)
 ├──► StargateNFT (ERC721 — mint/burn NFTs, maturity, boost, managers)
 └──► ProtocolStaker (protocol-level — validator/delegation VET deposits)
```

- **Stargate** orchestrates all user actions: stake, unstake, delegate, claim rewards
- **StargateNFT** is the ERC721 contract representing staking positions; mint/burn only callable by Stargate
- **ProtocolStaker** is the on-chain protocol contract managing validator stakes and delegation deposits

## Stargate

Main entry point for staking, delegation, and reward distribution. Upgradeable, pausable, access-controlled.

### Key Types

```solidity
enum DelegationStatus { NONE, PENDING, ACTIVE, EXITED }

struct Delegation {
    uint256 delegationId;
    address validator;
    uint256 stake;
    uint8   probabilityMultiplier;
    uint32  startPeriod;
    uint32  endPeriod;
    bool    isLocked;
    DelegationStatus status;
}
```

- **NONE**: no delegation exists
- **PENDING**: delegated but waiting for validator's next period to activate
- **ACTIVE**: earning rewards; stays ACTIVE even after requesting exit (until period ends)
- **EXITED**: delegation ended (user exited, validator exited, or pending delegation cancelled)

### Key Functions

#### Staking

| Function | Description |
|----------|-------------|
| `stake(uint8 levelId) payable → uint256` | Stake exact VET (msg.value) and mint NFT at given tier |
| `unstake(uint256 tokenId)` | Burn NFT, return VET; delegation must not be ACTIVE; auto-claims rewards |
| `stakeAndDelegate(uint8 levelId, address validator) payable → uint256` | Stake + immediately delegate |
| `migrateAndDelegate(uint256 tokenId, address validator) payable` | Migrate legacy node + delegate |

#### Delegation

| Function | Description |
|----------|-------------|
| `delegate(uint256 tokenId, address validator)` | Delegate to validator; active at next period; can re-delegate while PENDING |
| `requestDelegationExit(uint256 tokenId)` | Signal exit; PENDING exits immediately, ACTIVE waits for period end; irreversible |

#### Rewards

| Function | Description |
|----------|-------------|
| `claimRewards(uint256 tokenId)` | Claim VTHO for all completed periods since last claim |
| `claimableRewards(uint256 tokenId) → uint256` | View claimable VTHO (first 832 periods / batch 0) |
| `claimableRewards(uint256 tokenId, uint32 batch) → uint256` | View claimable VTHO for specific batch (832 periods each) |
| `lockedRewards(uint256 tokenId) → uint256` | View rewards locked in current ongoing period |
| `claimableDelegationPeriods(uint256 tokenId) → (uint32 lastClaimed, uint32 endPeriod)` | Period range for claimable rewards |

**Rewards edge cases**: `claimRewards` loops over periods and can run out of gas if >832 periods are unclaimed. Use `maxClaimablePeriods` (default 832) and call multiple times or use multi-clause transactions to claim before unstaking/re-delegating.

#### Query

| Function | Description |
|----------|-------------|
| `getDelegationDetails(uint256 tokenId) → Delegation` | Full delegation details |
| `getDelegationStatus(uint256 tokenId) → DelegationStatus` | Current status |
| `getDelegationIdOfToken(uint256 tokenId) → uint256` | Latest delegation ID |
| `hasRequestedExit(uint256 tokenId) → bool` | Whether exit was requested (true even if already EXITED) |
| `getEffectiveStake(uint256 tokenId) → uint256` | VET staked * reward multiplier for the tier |
| `getDelegatorsEffectiveStake(address validator, uint32 period) → uint256` | Total effective stake of all delegators for a validator in a period |

#### Admin

| Function | Description |
|----------|-------------|
| `pause() / unpause()` | Pause/unpause contract (DEFAULT_ADMIN_ROLE) |
| `setMaxClaimablePeriods(uint32)` | Set max periods per claim call (DEFAULT_ADMIN_ROLE) |

### Roles

| Role | Purpose |
|------|---------|
| DEFAULT_ADMIN_ROLE | Pause/unpause, set max claimable periods |
| UPGRADER_ROLE | Authorize contract upgrades |
| PAUSER_ROLE | Pause/unpause |

### Important Details

- Delegation activates at the **next validator period**, not immediately
- While PENDING, users can re-delegate to a different validator or cancel
- Once ACTIVE, `requestDelegationExit` is the only way out (irreversible, waits for period end)
- `unstake` and `delegate` auto-claim pending rewards
- VET flows: on delegate, VET moves from StargateNFT → ProtocolStaker; on exit, back through Stargate
- Probability multipliers: `PROB_MULTIPLIER_NODE` (Eco tiers) and `PROB_MULTIPLIER_X_NODE` (X tiers)
- Periods are validator-specific and numbered incrementally (not fixed duration)

### Key Events

| Event | Emitted when |
|-------|-------------|
| `DelegationInitiated(tokenId, validator, delegationId, amount, levelId, multiplier)` | Delegation created |
| `DelegationExitRequested(tokenId, validator, delegationId, exitPeriod)` | Exit requested |
| `DelegationWithdrawn(tokenId, validator, delegationId, amount, levelId)` | VET withdrawn from delegation |
| `DelegationRewardsClaimed(receiver, tokenId, delegationId, amount, firstPeriod, lastPeriod)` | Rewards claimed |

### Key Errors

| Error | Cause |
|-------|-------|
| `TokenUnderMaturityPeriod(tokenId)` | Trying to delegate before maturity ends |
| `InvalidDelegationStatus(tokenId, status)` | Operation invalid for current delegation status |
| `DelegationExitAlreadyRequested` | Exit already requested |
| `ValidatorNotActiveOrQueued(validator)` | Validator not available for delegation |
| `VetAmountMismatch(levelId, required, provided)` | Wrong VET amount for staking |
| `MaxClaimablePeriodsExceeded` | Too many periods to claim in one call |

---

## StargateNFT

ERC721 upgradeable contract representing staking positions. Mint/burn only callable by Stargate. Handles maturity periods, boosting, token managers, and level management.

### Key Functions

#### Minting / Burning (Stargate-only)

| Function | Description |
|----------|-------------|
| `mint(uint8 levelId, address to) → uint256` | Mint NFT at tier (Stargate only) |
| `burn(uint256 tokenId)` | Burn NFT (Stargate only) |
| `migrate(uint256 tokenId)` | Migrate legacy node to StargateNFT (Stargate only) |

#### Maturity & Boosting

| Function | Description |
|----------|-------------|
| `boost(uint256 tokenId)` | Skip maturity by paying VTHO (Stargate only) |
| `boostOnBehalfOf(address sender, uint256 tokenId)` | Boost on behalf of user (Stargate only) |
| `boostAmount(uint256 tokenId) → uint256` | VTHO cost to boost a specific token |
| `boostAmountOfLevel(uint8 levelId) → uint256` | VTHO cost to boost any token of this level |
| `boostPricePerBlock(uint8 levelId) → uint256` | Per-block VTHO rate for boosting |
| `maturityPeriodEndBlock(uint256 tokenId) → uint64` | Block when maturity ends |
| `isUnderMaturityPeriod(uint256 tokenId) → bool` | Whether token is still maturing |

#### Token Manager (Node Manager)

Managers can vote on VeVote and use the token in governance, but cannot claim rewards, transfer, delegate, or unstake. Manager is removed on transfer.

| Function | Description |
|----------|-------------|
| `addTokenManager(address manager, uint256 tokenId)` | Assign manager (owner only; replaces existing) |
| `removeTokenManager(uint256 tokenId)` | Remove manager (owner only) |
| `getTokenManager(uint256 tokenId) → address` | Get manager (returns owner if none) |
| `isTokenManager(address, uint256 tokenId) → bool` | Check if address is manager |
| `isManagedByOwner(uint256 tokenId) → bool` | Check if owner is also manager |
| `idsManagedBy(address) → uint256[]` | Token IDs managed by address (owned + managed, excludes managed-by-others) |
| `tokensManagedBy(address) → Token[]` | Same as above, returns full Token structs |
| `tokensOverview(address) → TokenOverview[]` | All tokens related to user (owned, managed, or both) |

#### Token & Level Queries

| Function | Description |
|----------|-------------|
| `getToken(uint256 tokenId) → Token` | Full token data |
| `getTokenLevel(uint256 tokenId) → uint8` | Level ID of token |
| `tokensOwnedBy(address) → Token[]` | All tokens owned by address (may OOG with many tokens) |
| `idsOwnedBy(address) → uint256[]` | Token IDs owned by address |
| `ownerTotalVetStaked(address) → uint256` | Total VET staked by address |
| `tokenExists(uint256 tokenId) → bool` | Whether token exists |
| `getCurrentTokenId() → uint256` | Latest minted token ID |

#### Level Management

| Function | Description |
|----------|-------------|
| `addLevel(LevelAndSupply, uint256 boostPricePerBlock)` | Add new tier (LEVEL_OPERATOR_ROLE) |
| `getLevelIds() → uint8[]` | All level IDs |
| `getLevel(uint8 levelId) → Level` | Level spec |
| `getLevels() → Level[]` | All level specs |
| `getLevelSupply(uint8 levelId) → (uint208 circulating, uint32 cap)` | Current supply and cap |
| `getLevelsCirculatingSupplies() → uint208[]` | Circulating supply for all levels |
| `getCirculatingSupplyAtBlock(uint8 levelId, uint48 block) → uint208` | Historical supply |

#### X Token Queries

| Function | Description |
|----------|-------------|
| `xTokensCount() → uint208` | Number of X tokens in circulation |
| `ownsXToken(address) → bool` | Whether owner holds any X token |
| `isXToken(uint256 tokenId) → bool` | Whether token is X category |

### Roles

| Role | Purpose |
|------|---------|
| DEFAULT_ADMIN_ROLE | Pause/unpause, transfer balance, admin functions |
| UPGRADER_ROLE | Authorize contract upgrades |
| PAUSER_ROLE | Pause/unpause |
| LEVEL_OPERATOR_ROLE | Add new staking levels/tiers |
| MANAGER_ROLE | Set base URI for NFT metadata |
| TOKEN_MANAGER_MIGRATOR_ROLE | Migrate token managers from legacy NodeManagementV3 |

### Important Details

- NFTs are **always transferable**, even when delegated (changed in V3)
- Transfer removes the token manager automatically
- VET amount tracked in StargateNFT contract (legacy from pre-Hayabusa, kept to avoid migration complexity)
- Migrated legacy nodes have **no maturity period**
- No upgrade/downgrade: once minted at a level, it stays at that level
- Users must deposit **exact** VET amount for the tier (no more, no less)
- V3 removed all VTHO generation logic (Hayabusa changed VTHO to require active delegation)
- `REWARD_MULTIPLIER_SCALING_FACTOR`: scaling factor for reward multiplier calculations

---

## ProtocolStaker (IProtocolStaker)

Protocol-level interface for validator staking and delegation. The Stargate contract interacts with this to manage VET deposits.

### Validator Functions

| Function | Description |
|----------|-------------|
| `addValidation(address validator, uint32 period) payable` | Create a new validator position |
| `increaseStake(address validator) payable` | Add VET to queued/active validator |
| `decreaseStake(address validator, uint256 amount)` | Remove VET from active validator |
| `signalExit(address validator)` | Signal intent to exit at period end |
| `withdrawStake(address validator)` | Withdraw VET after exit |
| `setBeneficiary(address validator, address beneficiary)` | Set reward beneficiary address |

### Delegation Functions

| Function | Description |
|----------|-------------|
| `addDelegation(address validator, uint8 multiplier) payable → uint256` | Create delegation position, returns delegationID |
| `signalDelegationExit(uint256 delegationID)` | Signal exit (funds available after period ends) |
| `withdrawDelegation(uint256 delegationID)` | Withdraw delegation VET |

### Query Functions

| Function | Description |
|----------|-------------|
| `getDelegation(uint256 delegationID) → (validator, stake, multiplier, isLocked)` | Delegation details |
| `getDelegationPeriodDetails(uint256 delegationID) → (startPeriod, endPeriod)` | Delegation period range |
| `getValidation(address validator) → (endorser, stake, weight, queuedStake, status, offlineBlock)` | Validator details |
| `getValidationPeriodDetails(address validator) → (period, startBlock, exitBlock, completedPeriods)` | Validator period details |
| `getValidationTotals(address validator) → (lockedVET, lockedWeight, queuedVET, exitingVET, nextPeriodWeight)` | Aggregate validator totals |
| `getDelegatorsRewards(address validator, uint32 period) → uint256` | Total delegator rewards for a validator period |
| `getWithdrawable(address validator) → uint256` | Withdrawable VET for an exited validator |
| `totalStake() → (totalStake, totalWeight)` | All active validators combined |
| `queuedStake() → uint256` | All queued validators combined |
| `getValidationsNum() → (activeCount, queuedCount)` | Number of active/queued validators |
| `issuance() → uint256` | Total VTHO generated in current block context |
| `firstActive() / firstQueued() / next(address)` | Linked list traversal for validators |
