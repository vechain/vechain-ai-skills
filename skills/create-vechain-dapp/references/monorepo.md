# Monorepo Templates

Turborepo monorepo with `apps/frontend` (Next.js) and `packages/contracts` (Hardhat + Solidity).
Source files from `shared.md` go under `apps/frontend/src/`.

## Directory structure

```text
{{PROJECT_NAME}}/
├── .github/workflows/deploy.yml
├── .gitignore
├── .nvmrc
├── package.json
├── turbo.json
├── apps/
│   └── frontend/
│       ├── .env.example
│       ├── .eslintrc.json
│       ├── next.config.js
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           └── (all shared.md src/ files here)
├── packages/
│   ├── contracts/
│   │   ├── .gitignore
│   │   ├── contracts/
│   │   │   └── HelloWorld.sol
│   │   ├── hardhat.config.ts
│   │   ├── package.json
│   │   ├── test/
│   │   │   └── HelloWorld.test.ts
│   │   └── tsconfig.json
│   ├── eslint-config/
│   │   ├── library.js
│   │   ├── next.js
│   │   └── package.json
│   └── typescript-config/
│       ├── base.json
│       ├── nextjs.json
│       └── package.json
```

## Root files

### `package.json`

```json
{
  "name": "{{PROJECT_NAME}}",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "contracts:compile": "turbo compile --filter=@{{PROJECT_NAME}}/contracts",
    "contracts:test": "turbo test --filter=@{{PROJECT_NAME}}/contracts",
    "clean": "turbo clean && rm -rf node_modules"
  },
  "dependencies": {
    "turbo": "^2.5.0"
  },
  "devDependencies": {
    "prettier": "^3.3.0"
  },
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "engines": {
    "node": "20.x.x"
  },
  "packageManager": "yarn@1.22.22"
}
```

### `turbo.json`

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalEnv": ["NEXT_PUBLIC_NETWORK", "NEXT_PUBLIC_BASE_PATH"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**", "out/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true,
      "dependsOn": ["^build"]
    },
    "lint": {
      "cache": false
    },
    "typecheck": {
      "cache": false
    },
    "compile": {
      "outputs": ["artifacts/**", "typechain-types/**", "cache/**"]
    },
    "test": {
      "cache": false
    },
    "clean": {
      "cache": false
    }
  }
}
```

### `.gitignore`

```text
node_modules/
.next/
out/
dist/
.env
.env.local
*.tsbuildinfo
next-env.d.ts
artifacts/
cache/
typechain-types/
coverage/
```

### `.nvmrc`

```text
20
```

## `apps/frontend/`

### `package.json`

```json
{
  "name": "@{{PROJECT_NAME}}/frontend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbo",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@chakra-ui/react": "^3.26.0",
    "@emotion/react": "^11.14.0",
    "@tanstack/react-query": "^5.64.2",
    "@vechain/vechain-kit": "latest",
    "next": "14.2.25",
    "next-themes": "^0.4.6",
    "react": "^18",
    "react-dom": "^18",
    "react-icons": "^5.5.0"
  },
  "devDependencies": {
    "@{{PROJECT_NAME}}/eslint-config": "*",
    "@{{PROJECT_NAME}}/typescript-config": "*",
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "eslint": "^8",
    "eslint-config-next": "14.2.25",
    "typescript": "^5"
  }
}
```

### `next.config.js`

Same as standalone — see `standalone.md`.

```javascript
/** @type {import('next').NextConfig} */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ""

const nextConfig = {
  output: "export",
  basePath: basePath || undefined,
  assetPrefix: basePath ? `${basePath}/` : undefined,
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: true },
}

module.exports = nextConfig
```

### `tsconfig.json`

```json
{
  "extends": "@{{PROJECT_NAME}}/typescript-config/nextjs.json",
  "compilerOptions": {
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "noUncheckedIndexedAccess": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": [".next", "node_modules", "out"]
}
```

### `.eslintrc.json`

```json
{
  "extends": ["@{{PROJECT_NAME}}/eslint-config/next"]
}
```

### `.env.example`

Same as shared — see `shared.md`.

## `packages/typescript-config/`

### `package.json`

```json
{
  "name": "@{{PROJECT_NAME}}/typescript-config",
  "version": "0.0.0",
  "private": true
}
```

### `base.json`

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true,
    "esModuleInterop": true,
    "incremental": false,
    "isolatedModules": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "NodeNext",
    "moduleDetection": "force",
    "moduleResolution": "NodeNext",
    "noUncheckedIndexedAccess": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "strict": true,
    "target": "ES2022"
  }
}
```

### `nextjs.json`

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "plugins": [{ "name": "next" }],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowJs": true,
    "jsx": "preserve",
    "noEmit": true
  }
}
```

## `packages/eslint-config/`

### `package.json`

```json
{
  "name": "@{{PROJECT_NAME}}/eslint-config",
  "version": "0.0.0",
  "private": true,
  "files": ["library.js", "next.js"],
  "devDependencies": {
    "@typescript-eslint/eslint-plugin": "^6.11.0",
    "@typescript-eslint/parser": "^6.11.0",
    "@vercel/style-guide": "^5.1.0",
    "eslint-config-prettier": "^9.0.0",
    "eslint-config-turbo": "^2.5.5",
    "eslint-plugin-only-warn": "^1.1.0",
    "typescript": "^5"
  }
}
```

### `library.js`

```javascript
const { resolve } = require("node:path")
const project = resolve(process.cwd(), "tsconfig.json")

module.exports = {
  extends: ["eslint:recommended", "prettier"],
  plugins: ["only-warn"],
  globals: { React: true, JSX: true },
  env: { node: true },
  settings: { "import/resolver": { typescript: { project } } },
  ignorePatterns: [".*.js", "node_modules/", "dist/"],
  overrides: [{ files: ["*.js?(x)", "*.ts?(x)"] }],
}
```

### `next.js`

```javascript
const { resolve } = require("node:path")
const project = resolve(process.cwd(), "tsconfig.json")

module.exports = {
  extends: [
    "eslint:recommended",
    "prettier",
    require.resolve("@vercel/style-guide/eslint/next"),
    "plugin:turbo/recommended",
  ],
  globals: { React: true, JSX: true },
  env: { node: true, browser: true },
  plugins: ["only-warn"],
  settings: { "import/resolver": { typescript: { project } } },
  ignorePatterns: [".*.js", "node_modules/"],
  overrides: [{ files: ["*.js?(x)", "*.ts?(x)"] }],
}
```

## `packages/contracts/`

### `package.json`

```json
{
  "name": "@{{PROJECT_NAME}}/contracts",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "compile": "hardhat compile",
    "build": "hardhat compile",
    "test": "hardhat test",
    "clean": "hardhat clean"
  },
  "devDependencies": {
    "@nomicfoundation/hardhat-toolbox": "^5.0.0",
    "@vechain/sdk-hardhat-plugin": "latest",
    "hardhat": "^2.22.0",
    "typescript": "^5"
  }
}
```

### `hardhat.config.ts`

```typescript
import { HardhatUserConfig } from "hardhat/config"
import "@nomicfoundation/hardhat-toolbox"
import "@vechain/sdk-hardhat-plugin"

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "paris",
    },
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: 1337,
    },
    vechain_solo: {
      url: "http://localhost:8669",
      accounts: {
        mnemonic: "denial kitchen pet squirrel other broom bar gas better priority spoil cross",
        count: 10,
      },
    },
    vechain_testnet: {
      url: "https://testnet.vechain.org",
      accounts: {
        mnemonic: process.env.MNEMONIC ?? "",
        count: 3,
      },
    },
    vechain_mainnet: {
      url: "https://mainnet.vechain.org",
      accounts: {
        mnemonic: process.env.MNEMONIC ?? "",
        count: 3,
      },
    },
  },
}

export default config
```

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "moduleResolution": "node",
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "declaration": true
  },
  "include": ["hardhat.config.ts", "contracts/**/*.sol", "test/**/*.ts"],
  "exclude": ["node_modules", "dist", "artifacts", "cache"]
}
```

### `contracts/HelloWorld.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract HelloWorld {
    string public greeting = "Hello, VeChain!";

    event GreetingChanged(string newGreeting);

    function setGreeting(string calldata _greeting) external {
        greeting = _greeting;
        emit GreetingChanged(_greeting);
    }
}
```

### `test/HelloWorld.test.ts`

```typescript
import { expect } from "chai"
import { ethers } from "hardhat"

describe("HelloWorld", function () {
  it("should return the initial greeting", async function () {
    const factory = await ethers.getContractFactory("HelloWorld")
    const contract = await factory.deploy()
    expect(await contract.greeting()).to.equal("Hello, VeChain!")
  })

  it("should update the greeting", async function () {
    const factory = await ethers.getContractFactory("HelloWorld")
    const contract = await factory.deploy()
    await contract.setGreeting("Hello, World!")
    expect(await contract.greeting()).to.equal("Hello, World!")
  })
})
```

### `.gitignore`

```text
artifacts/
cache/
typechain-types/
node_modules/
coverage/
```

## `.github/workflows/deploy.yml`

Set `NEXT_PUBLIC_BASE_PATH` to `/<repo-name>` for `username.github.io/<repo-name>`,
or empty string `""` for custom domains.

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
    paths:
      - "apps/frontend/**"
      - "packages/**"
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: yarn

      - run: yarn install --frozen-lockfile

      - run: yarn build
        env:
          NEXT_PUBLIC_BASE_PATH: ""
          NEXT_PUBLIC_NETWORK: "{{NETWORK_TYPE}}"
          NODE_OPTIONS: "--max-old-space-size=4096"

      - uses: actions/upload-pages-artifact@v3
        with:
          path: apps/frontend/out

  deploy:
    runs-on: ubuntu-latest
    needs: build
    environment:
      name: github-pages
      url: ${{ steps.deploy.outputs.page_url }}
    steps:
      - id: deploy
        uses: actions/deploy-pages@v4
```
