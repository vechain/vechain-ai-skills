# VeChain AI Skills

AI skills and plugins for VeChain development and agentic coding.

## Quick Start

```bash
# Skills CLI (any agent)
npx skills add vechain/vechain-ai-skills

# Claude Code Marketplace
/plugin marketplace add vechain/vechain-ai-skills
/plugin marketplace update vechain-ai  # Update to latest skills

# Install skills
/plugin install vechain-dev                  # Core VeChain SDK, fee delegation, multi-clause
/plugin install vechain-kit                  # Frontend dApps, wallet, social login
/plugin install smart-contract-development   # Solidity, Hardhat, testing, security
/plugin install vebetterdao                  # X2Earn apps, B3TR/VOT3, governance
/plugin install stargate                     # NFT staking, validators, delegation
/plugin install translate                    # i18n translation management
/plugin install grill-me                     # Relentless plan interviewer
/plugin install auto-voting-relayers         # Auto-voting & relayer system
/plugin install create-vechain-dapp          # Scaffold VeChain dApp projects
/plugin install vechain-react-native-dev     # React Native VeWorld wallet integration
/plugin install indexer-core                 # indexer-core library integration & maintenance

# Update frequently to always have up to date skills
```

## Skills

### vechain-dev

Core VeChain development — SDK usage, fee delegation (VIP-191), multi-clause transactions, dual-token model, and legacy migration from Connex/thor-devkit.

### vechain-kit

Frontend dApp development with VeChain Kit and dapp-kit — wallet connection, social login, smart accounts, hooks, components, React Query patterns, and transaction UX.

### smart-contract-development

Solidity smart contract development on VeChainThor — Hardhat setup, ERC-20/721 patterns, upgradeable contracts, gas optimization, testing with Thor Solo, security auditing, and ABI codegen.

### vebetterdao

VeBetterDAO and X2Earn app development — B3TR/VOT3 tokens, reward distribution, sustainability proofs, app submission, governance, VeVote, and quadratic funding.

### stargate

StarGate staking on VeChainThor — NFT-based staking, tiered rewards, validator delegation, node management, boosting, and Phase 2 changes.

### translate

Manages react-i18next translation files across 15 languages. Adds/removes keys, keeps files sorted, enforces fixed-word rules, and verifies sync with the source locale.

### grill-me

Interview you relentlessly about every aspect of a plan until shared understanding is reached. Walks down each branch of the design tree, resolving dependencies between decisions one-by-one.

### auto-voting-relayers

Complete domain knowledge for VeBetterDAO's auto-voting and relayer system -- smart contracts (XAllocationVoting, VoterRewards, RelayerRewardsPool), relayer node, relayer dashboard, fee mechanics, and veDelegate comparison.

### create-vechain-dapp

Scaffold a VeChain dApp with Next.js 14, VeChain Kit, Chakra UI v3, and GitHub Pages deployment. Supports standalone (frontend-only) or monorepo (Turbo + Hardhat contracts) modes.

### vechain-react-native-dev

React Native VeWorld wallet integration — deep link communication, NaCl encryption, transaction signing, certificate signing, EIP-712 typed data, and multi-network support via `@vechain/react-native-wallet-link`.

### indexer-core

VeChain `indexer-core` library — `IndexerFactory`, `IndexerRunner`, `LogsIndexer` vs `BlockIndexer` mode selection, ABI and business events, rollback semantics, and integration guidance.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and contribution guidelines.

## License

MIT License — see [LICENSE](LICENSE) for details.
