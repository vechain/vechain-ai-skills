# VeChain AI

AI plugins, agents, and tools for VeChain development.

## Quick Start

```bash
# Skills CLI (any agent)
npx skills add vechain/vechain-ai

# Claude Code Marketplace
/plugin marketplace add vechain/vechain-ai

# Install the plugin
/plugin install vechain-dev          # Full-stack VeChain development
```

## What's Included

### vechain-dev plugin

Six skills covering the full VeChain development stack:

| Skill | Description |
|-------|-------------|
| **dapp-development** | Frontend dApps with VeChain Kit or dapp-kit, React Query patterns, Turborepo conventions, SDK migration |
| **smart-contracts** | Solidity + Hardhat on VeChainThor, gas optimization, ABI codegen with TypeChain |
| **transaction-patterns** | Fee delegation (VIP-191), multi-clause transactions, delegation services |
| **testing** | Hardhat testing with Thor Solo local node, CI configuration |
| **security** | Smart contract vulnerability review, security checklists |
| **defi-ecosystem** | VeBetterDAO (X2Earn / B3TR), StarGate staking, governance (VeVote / VOT3) |

## Example Prompts

```text
"I want wallet management in my app"
"Help me build a VeBetter app"
"Add a button to send rewards to the users"
"Add social login to my app"
"Help me set up a Next.js app with VeChain Kit and social login"
"Review this contract for security issues"
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and contribution guidelines.

## License

MIT License — see [LICENSE](LICENSE) for details.
