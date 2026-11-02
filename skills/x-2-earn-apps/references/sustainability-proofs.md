# Sustainability Proofs, Impacts, and Metadata

## When to use

Use when the user asks about: sustainability proofs, impact tracking, proof types, impact codes, reward metadata, distributeRewardWithProof, distributeRewardWithProofAndMetadata, distributeNonProofReward, NonProofRewardDistributed, NonProofRewardCategory, on-chain proof format.

## V9 — Sustainable vs Bonus Rewards (read first)

Starting with `X2EarnRewardsPool` **V9**, the contract separates two reward flows so passport personhood reflects sustainable activity only.

| Flow | Entrypoint(s) | Registers passport action? | Proof required? |
|------|---------------|----------------------------|-----------------|
| **Sustainable** action | `distributeRewardWithProof`, `distributeRewardWithProofAndMetadata`, `distributeRewardWithProofForRound`, `distributeRewardWithProofAndMetadataForRound` | Yes | **Yes — mandatory in V9** (empty proof arrays revert with `"X2EarnRewardsPool: proof is mandatory"`) |
| **Bonus** / secondary reward (endorser, leaderboard, streak, cashback, referral, etc.) | `distributeNonProofReward(appId, amount, receiver, category, description)` | **No** | No (uses a typed `NonProofRewardCategory` enum instead) |
| Legacy no-proof distribution (DEPRECATED V9) | `distributeReward(appId, amount, receiver, "")`, `distributeRewardForRound(...)`, `distributeRewardDeprecated*` | Yes (registers action without a typed proof — the V9 problem) | No |

`distributeReward` is marked **deprecated** in V9 but kept for backward compatibility. New integrations MUST migrate to either `distributeRewardWithProof` (sustainable) or `distributeNonProofReward` (bonus).

### NonProofRewardCategory enum (V9)

The bonus-reward entrypoint takes a typed category so indexers can split payouts by intent:

| Enum value | Index | Typical use |
|------------|-------|-------------|
| `Endorser` | 0 | Endorser payouts |
| `Leaderboard` | 1 | Leaderboard / contest prizes |
| `Streak` | 2 | Consecutive-day / streak bonuses |
| `Cashback` | 3 | Cashback on purchases |
| `Referral` | 4 | Referral payouts |
| `Other` | 5 | Anything not covered above |

The dedicated `NonProofRewardDistributed(amount, appId, receiver, category, description, distributor)` event is emitted with `appId`, `receiver`, and `category` indexed. **Indexers MUST exclude this event from passport personhood signals.**

## Proof Format (Version 2)

Proofs are stored on-chain as emitted events. The JSON structure:

```json
{
  "version": 2,
  "description": "The description of the action",
  "proof": {
    "image": "https://image.png",
    "link": "https://twitter.com/tweet/1"
  },
  "impact": {
    "carbon": 100,
    "water": 200
  }
}
```

## Distribution Parameters

When calling `distributeRewardWithProof` on `X2EarnRewardsPool`:

| Parameter | Type | Description |
|-----------|------|-------------|
| `proofTypes` | `string[]` | Proof types provided, e.g. `["link", "image"]` |
| `proofValues` | `string[]` | Values matching proofTypes, e.g. `["https://twitter.com/tweet/123", "https://example.com/image.png"]` |
| `impactCodes` | `string[]` | Impact category codes, e.g. `["water", "timber"]` |
| `impactValues` | `uint256[]` | Values matching impactCodes, e.g. `[1000, 23]` |
| `description` | `string` | Optional description of the action |

**Mandatory rule (V9)**: `proofTypes` AND `proofValues` MUST be non-empty on every `distributeRewardWithProof*` entrypoint — empty arrays revert with `"X2EarnRewardsPool: proof is mandatory"`. The legacy "at least proof OR impact" relaxation no longer applies. If your reward is a non-sustainable payout, use `distributeNonProofReward` instead. Transaction also reverts if array lengths are mismatched or data is malformed.

---

## Proof Types

| Type | Description |
|------|-------------|
| `image` | Photo evidence of the sustainable action |
| `link` | URL to external proof (tweet, article, etc.) |
| `text` | Text description as proof |
| `video` | Video evidence of the action |

Multiple proofs can be provided simultaneously (e.g., a photo and a link).

---

## Impact Categories

**Critical**: Impact values MUST be numbers in the default minimum unit (milliliters, grams, watt-hours, etc.). Example: 1 liter of water = `1000` (milliliters).

| Key | Category | Unit | Description |
|-----|----------|------|-------------|
| `carbon` | Carbon Footprint Reduction | Grams (g) of CO2 equivalent | Decrease in greenhouse gas emissions |
| `water` | Water Conservation | Milliliters (ml) | Water saved |
| `energy` | Energy Conservation | Watt-hours (Wh) | Electricity saved |
| `waste_mass` | Waste Reduction | Grams (g) | Waste diverted from landfills |
| `timber` | Timber Conservation | Grams (g) | Timber saved |
| `plastic` | Plastic Reduction | Grams (g) | Plastic saved or reduced |
| `education_time` | Education Time | Seconds | Time spent learning about sustainability |
| `trees_planted` | Trees Planted | Count | Number of trees planted |
| `calories_burned` | Calories Burned | Calories (kcal) | Energy expenditure from physical activity |
| `sleep_quality_percentage` | Sleep Quality | Percentage (%) | Sleep quality improvement |
| `clean_energy_production_wh` | Clean Energy Production | Watt-hours (Wh) | Clean energy generated |

Apps should calculate impact based on these categories. If your app doesn't fit any existing category, you can submit a custom category and impact definition.

---

## Code Examples

### JavaScript

```typescript
import {
    ProviderInternalHDWallet, ThorClient,
    VeChainProvider, VeChainSigner,
} from "@vechain/sdk-network";
import { X2EarnRewardsPool } from "@vechain/vebetterdao-contracts";

const thor = ThorClient.fromUrl("https://mainnet.vechain.org");
const provider = new VeChainProvider(
    thor,
    new ProviderInternalHDWallet("your space separated mnemonic".split(" ")),
);
const rootSigner = await provider.getSigner();

const rewardsPool = thor.contracts.load(
    X2EarnRewardsPool.address.mainnet,
    X2EarnRewardsPool.abi,
    rootSigner as VeChainSigner,
);

const tx = await rewardsPool.transact.distributeRewardWithProof(
    APP_ID,
    amount,
    receiverAddress,
    ["link", "image"],
    ["https://link-to-proof.com", "https://link-to-image.com/1.png"],
    ["waste_mass"],
    [100],
    "User performed a sustainable action on my app",
);

await tx.wait();
```

### Solidity

```solidity
import "./interfaces/IX2EarnRewardsPool.sol";

contract MyContract {
    function sendReward() onlyAdmin {
        // Solidity requires dynamic arrays to be declared explicitly
        string[] memory proofTypes = new string[](1);
        proofTypes[0] = "link";

        string[] memory proofUrls = new string[](1);
        proofUrls[0] = action.proofUrl;

        string[] memory impactTypes = new string[](1);
        impactTypes[0] = "waste_mass";

        uint256[] memory impactValues = new uint256[](1);
        impactValues[0] = calculateWasteMass(
            challenge.litterSize,
            challenge.litterCount
        );

        IX2EarnRewardsPool x2EarnRewardsPool = IX2EarnRewardsPool(
            x2EarnRewardsPoolAddress
        );

        x2EarnRewardsPool.distributeRewardWithProof(
            VBD_APP_ID,
            rewardAmount,
            receiver,
            proofTypes,
            proofUrls,
            impactTypes,
            impactValues,
            "User participated in a solo cleanup"
        );
    }
}
```

---

## Reward Metadata

The `distributeRewardWithProofAndMetadata` function allows enriching distributions with additional contextual information. Metadata is emitted via the `RewardMetadata` event for off-chain indexing and analytics.

### Suggested Metadata Structure

```json
{
  "location": {
    "city": "Berlin",
    "country": "Germany",
    "region": "EU"
  },
  "referral_source": "social_media",
  "campaign_id": "earth_day_2025"
}
```

**Privacy note**: Including location metadata may require updating your privacy policy and terms of service.

### JavaScript Example

```typescript
const metadata = {
    location: { city: "Berlin", country: "Germany", region: "EU" },
    referral_source: "social_media",
    campaign_id: "earth_day_2025",
};

const tx = await rewardsPool.transact.distributeRewardWithProofAndMetadata(
    APP_ID,
    amount,
    receiverAddress,
    ["link", "image"],
    ["https://link-to-proof.com", "https://link-to-image.com/1.png"],
    ["waste_mass"],
    [100],
    "User performed a sustainable action on my app",
    JSON.stringify(metadata),
);

await tx.wait();
```

### Solidity Example

```solidity
function sendRewardWithMetadata() onlyAdmin {
    // ... set up proof and impact arrays as above ...

    string memory metadata = '{"location":{"city":"Berlin","country":"Germany","region":"EU"},'
        '"referral_source":"social_media","campaign_id":"earth_day_2025"}';

    x2EarnRewardsPool.distributeRewardWithProofAndMetadata(
        VBD_APP_ID,
        rewardAmount,
        receiver,
        proofTypes,
        proofUrls,
        impactTypes,
        impactValues,
        "User participated in a solo cleanup",
        metadata
    );
}
```

### RewardMetadata Event

Emitted on successful `distributeRewardWithProofAndMetadata`:

| Parameter | Type | Description |
|-----------|------|-------------|
| `amount` | `uint256` | Distributed reward amount |
| `appId` | `bytes32` | Application identifier |
| `receiver` | `address` | Address receiving the reward |
| `metadata` | `string` | JSON-formatted metadata string |
| `distributor` | `address` | Address initiating the distribution |

### Guidelines

- **Optional**: If your app doesn't need extra context, use `distributeRewardWithProof` instead
- **Standardization**: Follow the suggested structure for ecosystem consistency
- **Validation**: Ensure metadata JSON is correctly formatted before calling the function

---

## Deprecated Proof Format (Version 1)

If no `version` field is found, treat as version 1:

```json
{
  "app_name": "cleanify",
  "action_type": "litter_picking",
  "proof": {
    "proof_type": "link",
    "proof_data": "https://x.com/user/status/123456"
  },
  "metadata": {
    "description": "User picked up 8 small pieces of litter.",
    "additional_info": ""
  },
  "impact": {
    "waste_mass": "300",
    "biodiversity": "1"
  }
}
```

Deprecated impact codes: `waste_items`, `people`, `biodiversity`.

### Distribution Functions Summary

| Function | Use case | V9 status |
|----------|----------|-----------|
| `distributeRewardWithProof(appId, amount, receiver, proofTypes, proofValues, impactCodes, impactValues, description)` | Standard — typed arrays for proof and impact | **Proof mandatory** (V9) — registers passport action |
| `distributeRewardWithProofAndMetadata(appId, amount, receiver, proofTypes, proofValues, impactCodes, impactValues, description, metadata)` | Adds JSON metadata for off-chain indexing | **Proof mandatory** (V9) — registers passport action |
| `distributeRewardWithProofForRound(..., actionRound)` | Proof distribution attributed to a specific round | **Proof mandatory** (V9) — registers passport action for the supplied round |
| `distributeRewardWithProofAndMetadataForRound(..., actionRound)` | Proof + metadata distribution attributed to a specific round | **Proof mandatory** (V9) — registers passport action for the supplied round |
| `distributeNonProofReward(appId, amount, receiver, category, description)` | **NEW V9** — bonus / non-sustainable payout (endorser, leaderboard, streak, cashback, referral, other) | **Does NOT register a passport action.** Emits `NonProofRewardDistributed`. |
| `distributeReward(appId, amount, receiver, proof)` | Legacy no-proof distribution | **DEPRECATED V9** (kept for backward compatibility) |
| `distributeRewardForRound(appId, amount, receiver, proof, actionRound)` | Legacy no-proof distribution attributed to a round | Still callable in V9 but follow the same migration as `distributeReward` |
| `distributeRewardDeprecated(appId, amount, receiver, proof)` | Legacy JSON-string proof | Pre-existing deprecation, kept for backward compatibility |
| `distributeRewardDeprecatedForRound(appId, amount, receiver, proof, actionRound)` | **NEW V9** — round-attribution counterpart of `distributeRewardDeprecated` | Pre-existing deprecation scheme, added for parity with `*ForRound` family |

### Round Attribution

By default, actions are recorded in the current round. If your app allows users to accumulate actions and claim them later, use the `ForRound` variants to attribute actions to the round they were performed in. The `actionRound` parameter must be > 0 and represents the round ID when the action actually happened. `distributeNonProofReward` has **no** `ForRound` variant because bonus rewards do not register a passport action — round attribution is not applicable.

### Bonus Reward Example — `distributeNonProofReward` (V9)

```typescript
// NonProofRewardCategory matches the IX2EarnRewardsPool interface order
const NonProofRewardCategory = {
    Endorser: 0,
    Leaderboard: 1,
    Streak: 2,
    Cashback: 3,
    Referral: 4,
    Other: 5,
} as const;

const tx = await rewardsPool.transact.distributeNonProofReward(
    APP_ID,
    amount,
    receiverAddress,
    NonProofRewardCategory.Leaderboard,
    "Week 12 leaderboard - 3rd place",
);

await tx.wait();
```

```solidity
function payLeaderboardPrize(address winner, uint256 amount, uint8 place) external onlyAdmin {
    x2EarnRewardsPool.distributeNonProofReward(
        VBD_APP_ID,
        amount,
        winner,
        IX2EarnRewardsPool.NonProofRewardCategory.Leaderboard,
        string.concat("Week ", Strings.toString(currentWeek), " leaderboard - place ", Strings.toString(place))
    );
}
```
