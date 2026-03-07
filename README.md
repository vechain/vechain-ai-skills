# VeChain AI Skills

AI skills and plugins for VeChain development and agentic coding.

## Quick Start

```bash
# Skills CLI (any agent)
npx skills add vechain/vechain-ai-skills

# Claude Code Marketplace
/plugin marketplace add vechain/vechain-ai-skills

# Install skills
/plugin install vechain-dev          # Full-stack VeChain development
/plugin install karpathy-guidelines  # LLM coding best practices
/plugin install translate            # i18n translation management
/plugin install grill-me             # Relentless plan interviewer
/plugin install prd                  # PRD generator
/plugin install ralph                # Autonomous agent runner
/plugin install auto-voting-relayers # Auto-voting & relayer system
```

## Skills

### vechain-dev

Full-stack VeChain development — dApps (VeChain Kit, dapp-kit), smart contracts (Solidity + Hardhat), fee delegation, multi-clause transactions, testing, security, and DeFi ecosystem (VeBetterDAO, StarGate, governance).

### karpathy-guidelines

Behavioral guidelines to reduce common LLM coding mistakes. Surface assumptions, make surgical changes, keep code simple, and define verifiable success criteria.

### translate

Manages react-i18next translation files across 15 languages. Adds/removes keys, keeps files sorted, enforces fixed-word rules, and verifies sync with the source locale.

### grill-me

Interview you relentlessly about every aspect of a plan until shared understanding is reached. Walks down each branch of the design tree, resolving dependencies between decisions one-by-one.

### prd

Generate structured Product Requirements Documents with clarifying questions, user stories, acceptance criteria, and functional requirements. Outputs to `tasks/prd-[feature-name].md`.

### ralph

Autonomous agent runner that implements features from PRDs. Converts PRDs to `prd.json`, then executes user stories one at a time via Claude CLI — each iteration implements one story, runs type checks, commits, and moves to the next.

### auto-voting-relayers

Complete domain knowledge for VeBetterDAO's auto-voting and relayer system -- smart contracts (XAllocationVoting, VoterRewards, RelayerRewardsPool), relayer node, relayer dashboard, fee mechanics, and veDelegate comparison.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and contribution guidelines.

## License

MIT License — see [LICENSE](LICENSE) for details.
