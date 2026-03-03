# Governance (VeVote & VeBetterDAO)

## When to use

Use when the user asks about: voting, proposals, steering committee elections, VOT3 governance, on-chain voting mechanisms.

## Two Governance Systems

| System | Platform | Voting Asset | Purpose |
|--------|----------|-------------|---------|
| **VeVote** | [vevote.vechain.org](https://vevote.vechain.org/) | Stargate NFTs | Protocol upgrades, steering committee elections, network parameters |
| **VeBetterDAO Governor** | VeBetterDAO dApp | VOT3 token | dApp allocation rounds, ecosystem fund distribution, DAO proposals |

---

## VeVote (Protocol Governance)

On-chain governance platform where Validators and Node holders vote on proposals. All votes are recorded on-chain (tamper-proof, publicly verifiable).

### Proposal Types

- **Steering Committee Voting** -- Election of the Board of Steering Committee
- **All Stakeholders Voting** -- Protocol changes (e.g., VIP-253 Hayabusa upgrade)

### Voting Power

Weighted by **Stargate NFT tier level** (highest to lowest):

Mjolnir X → Thunder X → Strength X → VeThor X → Mjolnir → Thunder → Strength → Flash → Lightning → Dawn

Voting units in the contract are scaled by 100 to avoid underflow (e.g., 150 = 1.5x).

### Voting Rules

- Total voting power applied to the option you select
- One vote per wallet per proposal, **cannot be changed**
- Options: **For**, **Against**, **Abstain**
- Power calculated at the moment of vote (not at proposal start)

### Delegation

Via Stargate NFT **Node Manager** feature: an NFT owner assigns a secondary wallet that gains full voting power for managed NFT(s).

### Contract Address

| Contract | Network | Address |
|----------|---------|---------|
| Steering Committee Vote | Mainnet | `0xDBAeC4165A6cff07901C41D3561EEFdCFbc20CB6` |

### Developer Resources

- **Monorepo**: [github.com/vechain/vevote](https://github.com/vechain/vevote) -- `packages/contracts/` + `apps/frontend/`
- **Legacy contracts**: [github.com/vechain/vevote-contracts](https://github.com/vechain/vevote-contracts)
- **Stack**: Solidity + Hardhat (contracts), React + Vite (frontend), VeChain Kit (wallet)

---

## VeBetterDAO Governance

Uses OpenZeppelin **Governor pattern** (AccessControl + UUPSUpgradeable).

### Voting Token: VOT3

- Obtained by swapping B3TR at **1:1 ratio** (auto-delegates to holder on receipt)
- Minimum **1 VOT3** to participate in governance
- See [vebetterdao.md](vebetterdao.md) for B3TR/VOT3 token details and contract addresses

### Governance Proposals

1. Proposer creates proposal with VOT3 deposit
2. **Deposit threshold** (% of total B3TR supply) must be met → temperature check
3. If threshold reached before waiting period ends → proposal becomes active
4. Voting period opens; quorum: **30% of total VOT3 supply**
5. If quorum met and "yes" > "no" → executes via TimeLock

### Allocation Rounds

- Weekly rounds where VOT3 holders vote on X2Earn app funding
- **Quadratic Funding** formula (number of supporters matters more than vote size)
- Quorum: **1% of total VOT3 supply** (if not met, uses last valid round's percentages)

### Voter Rewards

- **Vote2Earn Pool**: Rewards all participants based on VOT3 balance
- **GM Rewards Pool**: 5% of weekly emissions → voters with GM NFT

---

## VePassport (Voting Eligibility)

Verifies wallet authenticity for VeBetterDAO allocation round voting. Requires **3 sustainable actions in the last 12 rounds**.

| Contract | Network | Address |
|----------|---------|---------|
| VePassport | Mainnet | `0x35a267671d8EDD607B2056A9a13E7ba7CF53c8b3` |
