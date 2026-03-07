# Contributing

We welcome contributions! This guide covers development setup, the repo architecture, and how to add skills.

## Development Setup

```bash
git clone https://github.com/vechain/vechain-ai-skills
cd vechain-ai-skills
npm install
npm run validate              # Validate plugin structure
npm run lint-markdown          # Lint markdown files
```

## Repo Structure

```text
.claude-plugin/
  marketplace.json                # Plugin marketplace catalog
  plugin.json                     # Plugin manifest (name, version, skills)
skills/
  vechain-dev/                    # SKILL.md + references/ (15 files)
scripts/                          # Validation and install scripts
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

This repo supports three install methods. All must stay in sync:

| Channel | Command | What it does |
|---------|---------|-------------|
| **Plugin marketplace** | `/plugin marketplace add vechain/vechain-ai-skills` | Claude Code reads `.claude-plugin/marketplace.json`, then `/plugin install <name>` |
| **Skills CLI** | `npx skills add vechain/vechain-ai-skills` | Agent-agnostic CLI finds `SKILL.md` files |
| **Local install** | `./scripts/install-local.sh` | Copies skills to `~/.claude/skills/` for development |

## Adding a New Skill

1. Create the skill directory:

    ```bash
    mkdir -p skills/my-new-skill
    ```

2. Create `SKILL.md` with frontmatter:

    ```markdown
    ---
    name: my-new-skill
    description: Short description of what this skill covers
    allowed-tools: []
    license: MIT
    metadata:
      author: VeChain
      version: "0.1.0"
    ---

    # My New Skill

    Content here...
    ```

3. (Optional) Add reference files in `references/`:

    ```text
    skills/my-new-skill/
      SKILL.md
      references/
        detailed-topic.md
        another-topic.md
    ```

4. Register the skill in `.claude-plugin/plugin.json`:

    ```json
    "skills": [
      "./skills/vechain-dev",
      "./skills/my-new-skill"
    ]
    ```

5. Register the skill in `.claude-plugin/marketplace.json` (required for `/plugin install` to find it):

    ```json
    "plugins": [
      {
        "name": "my-new-skill",
        "source": { "source": "github", "repo": "vechain/vechain-ai-skills" },
        "description": "Short description"
      }
    ]
    ```

6. Validate:

    ```bash
    npm run validate
    npm run lint-markdown
    ```

## Key Files Reference

| File | Purpose |
|------|---------|
| `.claude-plugin/marketplace.json` | Root catalog — lists installable plugins |
| `.claude-plugin/plugin.json` | Plugin manifest — name, version, skills list |
| `skills/*/SKILL.md` | Skill content with YAML frontmatter |
| `skills/*/references/*.md` | Supplementary reference docs loaded on demand |
| `scripts/validate-plugin.cjs` | Validates structure, frontmatter, and plugin.json consistency |
| `scripts/install-local.sh` | Local install for development/testing |

## SKILL.md Conventions

- **Frontmatter** must include: `name`, `description`, `license`
- **`name`** must match the directory name
- Skills use `references/` for supplementary docs and a progressive disclosure table in SKILL.md
- Cross-references between reference files use relative paths

## PR Checklist

- [ ] `npm run validate` passes
- [ ] `npm run lint-markdown` passes
- [ ] New skills are registered in `.claude-plugin/plugin.json`
- [ ] New skills are registered in `.claude-plugin/marketplace.json`
- [ ] Cross-references between files use correct relative paths

## Content Sources

- [VeChain Documentation](https://docs.vechain.org/)
- [VeChain Kit Documentation](https://docs.vechainkit.vechain.org/)
- [VeChain SDK](https://github.com/vechain/vechain-sdk-js)
- [VeBetterDAO Documentation](https://docs.vebetterdao.org/)
- [StarGate Documentation](https://docs.stargate.vechain.org/)
