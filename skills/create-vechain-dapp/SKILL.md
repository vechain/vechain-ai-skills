---
name: create-vechain-dapp
description: Scaffold a VeChain dApp with Next.js, VeChain Kit, Chakra UI v3, and GitHub Pages deployment. Supports standalone (frontend-only) or monorepo (Turbo + Hardhat contracts) modes. Use when creating a new VeChain project, scaffolding a dApp, setting up a VeChain frontend, or bootstrapping a VeChain monorepo.
allowed-tools: []
license: MIT
metadata:
  author: VeChain
  version: "0.1.0"
---

# Create VeChain dApp

Scaffold a production-ready VeChain dApp with wallet connection, dark mode, and GitHub Pages deployment.

## CRITICAL RULES

1. **Read reference files FIRST.** Based on the user's chosen mode, read the appropriate reference files before creating any files. Briefly mention which files you are reading so the user can confirm the skill is active.
2. **Always read `shared.md`** — it contains the source code templates used by both modes.
3. **Replace all placeholders** in every template before writing files. See Variable Substitution below.
4. **After compaction or context loss**, re-read this SKILL.md to restore awareness of the reference table and operating procedure.

## Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router, static export) |
| UI | Chakra UI v3, next-themes |
| Wallet | @vechain/vechain-kit (VeWorld + WalletConnect) |
| State | React Query |
| Contracts | Hardhat + @vechain/sdk-hardhat-plugin (monorepo only) |
| Build | Turborepo (monorepo only) |
| Deploy | GitHub Pages via GitHub Actions |
| Node | 20 LTS |

## Operating procedure

### Phase 1 — Gather requirements

Ask the user (use structured questions if available):

1. **Project name** — kebab-case (e.g. `my-vechain-dapp`)
2. **Mode** — `standalone` (frontend only) or `monorepo` (Turbo + contracts)
3. **Network** — `test` or `main` (default: `test`)
4. **Target directory** — where to create the project (default: current directory)

### Phase 2 — Scaffold

Read the appropriate reference files and create all files.

**Standalone mode:**

1. Read [references/shared.md](references/shared.md)
2. Read [references/standalone.md](references/standalone.md)
3. Create files in `{{TARGET_DIR}}/{{PROJECT_NAME}}/`

**Monorepo mode:**

1. Read [references/shared.md](references/shared.md)
2. Read [references/monorepo.md](references/monorepo.md)
3. Create frontend files in `{{TARGET_DIR}}/{{PROJECT_NAME}}/apps/frontend/`
4. Create other files at monorepo root and in `packages/`

### Variable substitution

Replace these placeholders in ALL templates:

| Placeholder | Value |
|-------------|-------|
| `{{PROJECT_NAME}}` | kebab-case project name |
| `{{PROJECT_TITLE}}` | Title-case project name (for UI display) |
| `{{NETWORK_TYPE}}` | `test` or `main` |

### Phase 3 — Install and verify

```bash
cd {{PROJECT_NAME}}
nvm use
yarn install
```

**Standalone:** `yarn dev` (localhost:3000), `yarn build` (static export → `out/`)

**Monorepo:** `yarn dev`, `yarn build`, `yarn contracts:compile`, `yarn contracts:test`

### Phase 4 — Git init

```bash
git init && git add . && git commit -m "Initial scaffold: VeChain dApp"
```

## Success criteria

- `yarn dev` starts without errors
- Page renders with Navbar and wallet connect button
- Dark/light mode toggle works
- `yarn build` produces static output
- `.github/workflows/deploy.yml` is present

## Key patterns

### Client-only VeChain Kit

VeChain Kit cannot run server-side. The entire app shell (`ClientApp`) is loaded via `dynamic(() => ..., { ssr: false })` in `layout.tsx`. All VeChain Kit imports inside `ClientApp` children work normally since the parent is already client-only.

### Static export for GitHub Pages

`next.config.js` uses `output: "export"` with configurable `basePath`/`assetPrefix` via `NEXT_PUBLIC_BASE_PATH` env var. GitHub Actions sets this for GitHub Pages deployment.

### Provider chain

`ChakraProvider` → `ColorModeProvider` → `QueryClientProvider` → `VeChainKitProvider` → App

### VeChain Kit integration

- `VeChainKitProvider` wraps the app with network config and wallet options
- `WalletButton` from vechain-kit renders the connect/account button
- `useWallet`, `useSendTransaction`, `useCallClause` for wallet/contract interaction
- Refer to the `vechain-kit` skill for advanced patterns (hooks, theming, social login)
- Refer to the `vechain-dev` skill for SDK patterns (fee delegation, multi-clause)

## Reference files

Read the matching files BEFORE creating any files. See Critical Rules above.

| Topic | File | Read when... |
|-------|------|-------------|
| Shared source code | [references/shared.md](references/shared.md) | Always — contains all component/provider templates |
| Standalone config | [references/standalone.md](references/standalone.md) | User chose standalone mode (frontend only) |
| Monorepo config | [references/monorepo.md](references/monorepo.md) | User chose monorepo mode (Turbo + contracts) |
