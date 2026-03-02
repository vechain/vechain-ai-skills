# VeChain AI

AI plugins, agents, and tools for VeChain development.

## Overview

This monorepo contains:

- **Plugins** — Claude Code skills for VeChain development (`packages/plugins/`)
- **Evals** — Promptfoo evaluation suites for testing skill quality (`evals/`)
- **Docs** — This documentation site (`docs/`)

## Getting Started

### Install the VeChain Dev Plugin

```bash
npx skills add https://github.com/vechain/vechain-ai
```

### Local Development

```bash
git clone https://github.com/vechain/vechain-ai
cd vechain-ai
npm install
npx nx run vechain-dev:validate
```

## Skills

The `vechain-dev` plugin provides 6 skills:

| Skill | Description |
|-------|-------------|
| `dapp-development` | Frontend dApps, VeChain Kit, dapp-kit, React Query |
| `smart-contracts` | Solidity + Hardhat, gas optimization, ABI codegen |
| `transaction-patterns` | Fee delegation, multi-clause transactions |
| `testing` | Hardhat testing with Thor Solo |
| `security` | Smart contract vulnerability patterns |
| `defi-ecosystem` | VeBetterDAO, StarGate, governance |
