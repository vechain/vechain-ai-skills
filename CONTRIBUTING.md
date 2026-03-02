# Contributing

We welcome contributions! This guide covers development setup, the repo architecture, and how to add skills and plugins.

## Development Setup

```bash
git clone https://github.com/vechain/vechain-ai
cd vechain-ai
npm install
npx nx run vechain-dev:validate       # Validate plugin structure
npx nx run vechain-dev:lint-markdown   # Lint markdown files
```

## Repo Structure

```text
.claude-plugin/
  marketplace.json                          # Plugin marketplace catalog
packages/plugins/vechain-dev/
  .claude-plugin/
    plugin.json                             # Plugin manifest (name, version, skills)
  skills/
    dapp-development/                       # SKILL.md + references/
    smart-contracts/                        # SKILL.md + references/
    transaction-patterns/                   # SKILL.md + references/
    testing/                                # SKILL.md (single-file)
    security/                               # SKILL.md (single-file)
    defi-ecosystem/                         # SKILL.md + references/
scripts/                                    # Validation and install scripts
evals/                                      # Promptfoo evaluation suites
docs/                                       # Documentation
```

## Default Stack

The skills encode these opinionated defaults:

| Layer | Default | Alternative |
|-------|---------|-------------|
| Frontend | `@vechain/vechain-kit` | `@vechain/dapp-kit-react` (lightweight) |
| SDK | `@vechain/sdk-core` + `sdk-network` | `@vechain/sdk-ethers-adapter` |
| Contracts | Solidity + Hardhat | -- |
| EVM target | `paris` (mandatory) | -- |
| Testing | Hardhat + Thor Solo | -- |
| Social Login | Privy (via VeChain Kit) | DIY with dapp-kit + Privy |

## Distribution Channels

This repo supports three ways users can install plugins. All must stay in sync:

| Channel | Command | What it does |
|---------|---------|-------------|
| **Plugin marketplace** | `/plugin marketplace add vechain/vechain-ai` | Claude Code reads `.claude-plugin/marketplace.json`, then `/plugin install <name>` installs individual plugins |
| **Skills CLI** | `npx skills add vechain/vechain-ai` | Agent-agnostic CLI finds `SKILL.md` files and installs them into any supported coding agent |
| **Local install** | `./scripts/install-local.sh` | Copies skills to `~/.claude/skills/` for development and testing |

The **marketplace** path requires two metadata files:

- **`.claude-plugin/marketplace.json`** (repo root) — lists all plugins in the repo
- **`.claude-plugin/plugin.json`** (per plugin) — declares the plugin's skills, version, and metadata

## Adding a New Skill to an Existing Plugin

1. Create the skill directory:

    ```bash
    mkdir -p packages/plugins/vechain-dev/skills/my-new-skill
    ```

2. Create `SKILL.md` with frontmatter:

    ```markdown
    ---
    name: my-new-skill
    description: Short description of what this skill covers
    allowed-tools: []
    model: sonnet
    license: MIT
    metadata:
      author: VeChain
      version: "0.1.0"
    ---

    # My New Skill

    Content here...
    ```

3. (Optional) Add reference files in `references/` for supplementary docs:

    ```text
    packages/plugins/vechain-dev/skills/my-new-skill/
      SKILL.md
      references/
        detailed-topic.md
        another-topic.md
    ```

4. Register the skill in `packages/plugins/vechain-dev/.claude-plugin/plugin.json`:

    ```json
    "skills": [
      "./skills/dapp-development",
      "./skills/my-new-skill"
    ]
    ```

5. Validate:

    ```bash
    npx nx run vechain-dev:validate
    npx nx run vechain-dev:lint-markdown
    ```

## Adding a New Plugin

Plugins are independent packages under `packages/plugins/`. To add a new one:

1. Create the plugin directory:

    ```bash
    mkdir -p packages/plugins/my-plugin/{skills,.claude-plugin}
    ```

2. Add required files:

    ```text
    packages/plugins/my-plugin/
      .claude-plugin/
        plugin.json          # name, version, description, skills array
      package.json           # @vechain-ai/my-plugin, private: true
      project.json           # Nx project config
      skills/
        some-skill/
          SKILL.md
    ```

3. Register in the root marketplace (`.claude-plugin/marketplace.json`):

    ```json
    "plugins": [
      { "name": "vechain-dev", "source": "./packages/plugins/vechain-dev", "description": "..." },
      { "name": "my-plugin", "source": "./packages/plugins/my-plugin", "description": "..." }
    ]
    ```

4. Users can then install it individually:

    ```bash
    /plugin install my-plugin
    ```

## Key Files Reference

| File | Purpose |
|------|---------|
| `.claude-plugin/marketplace.json` | Root catalog — lists all installable plugins |
| `packages/plugins/*/.claude-plugin/plugin.json` | Per-plugin manifest — name, version, skills list |
| `packages/plugins/*/skills/*/SKILL.md` | Skill content with YAML frontmatter |
| `packages/plugins/*/skills/*/references/*.md` | Supplementary reference docs loaded on demand |
| `scripts/validate-plugin.cjs` | Validates structure, frontmatter, and plugin.json consistency |
| `scripts/install-local.sh` | Local install for development/testing |
| `.markdownlint-cli2.jsonc` | Markdown linting rules |

## SKILL.md Conventions

- **Frontmatter** must include: `name`, `description`, `license`
- **`name`** must match the directory name (e.g., `name: testing` in `skills/testing/SKILL.md`)
- **Single-file skills** (like `testing`, `security`) inline all content in SKILL.md
- **Multi-file skills** use `references/` for supplementary docs and a progressive disclosure table in SKILL.md
- Cross-references between skills use relative paths (e.g., `../../transaction-patterns/references/fee-delegation.md`)

## PR Checklist

- [ ] `npx nx run vechain-dev:validate` passes
- [ ] `npx nx run vechain-dev:lint-markdown` passes
- [ ] New skills are registered in the plugin's `plugin.json`
- [ ] New plugins are registered in the root `marketplace.json`
- [ ] Cross-references between files use correct relative paths

## Content Sources

- [VeChain Documentation](https://docs.vechain.org/)
- [VeChain Kit Documentation](https://docs.vechainkit.vechain.org/)
- [VeChain SDK](https://github.com/vechain/vechain-sdk-js)
- [VeBetterDAO Documentation](https://docs.vebetterdao.org/)
- [StarGate Documentation](https://docs.stargate.vechain.org/)
