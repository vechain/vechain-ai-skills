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
.cursor-plugin/
  plugin.json                     # Cursor plugin manifest (VeChain skills subset)
assets/
  logo.png                        # Plugin logo (Cursor marketplace)
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

This repo supports four install methods. All must stay in sync:

| Channel | Command | What it does |
|---------|---------|-------------|
| **Plugin marketplace** | `/plugin marketplace add vechain/vechain-ai-skills` | Claude Code reads `.claude-plugin/marketplace.json`, then `/plugin install <name>` |
| **Skills CLI** | `npx skills add vechain/vechain-ai-skills` | Agent-agnostic CLI finds `SKILL.md` files |
| **Local install** | `./scripts/install-local.sh` | Copies skills to `~/.claude/skills/` for development |
| **Cursor marketplace** | `/add-plugin vechain` | Cursor reads `.cursor-plugin/plugin.json` (VeChain-specific skills only) |

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

6. If the skill is VeChain-specific, also register it in `.cursor-plugin/plugin.json` `skills`
   (generic skills like `grill-me` or `translate` are intentionally excluded from Cursor).

7. Validate:

    ```bash
    npm run validate
    npm run lint-markdown
    ```

## Testing Your Skill

Passing `npm run validate` means your skill is **structurally correct** — but that doesn't tell you whether it actually works in Claude Code. Follow this workflow to functionally test your skill before opening a PR.

### Step 1 — Run all structural checks

```bash
npm run validate          # Frontmatter, plugin.json consistency
npm run lint-markdown     # Markdown formatting
npm run verify-refs       # Links and cross-references resolve
npm run security-audit    # No secrets, injection patterns, or unsafe URLs
npm run size-report       # Token budget (SKILL.md < 2 000, refs < 5 000 each)
```

Fix any errors before proceeding. These same checks run in CI on every PR.

### Step 2 — Install locally

```bash
./scripts/install-local.sh            # Installs to ~/.claude/skills/vechain-dev
# or
./scripts/install-local.sh --project  # Installs to .claude/skills/vechain-dev (current project only)
```

> **Tip:** Use `--project` when you want the skill scoped to a single repo for isolated testing.

### Step 3 — Open a Claude Code session and invoke the skill

Start a **new** Claude Code session (skills are loaded at startup) and try prompts that should trigger your skill. For example, if your skill covers "token bridging":

```text
How do I bridge B3TR tokens to Ethereum?
```

Check that:

- **The skill activates** — Claude should use information from your SKILL.md, not generic knowledge
- **Reference files load on demand** — if your skill has a progressive disclosure table, ask a question that requires a specific reference and verify it gets pulled in
- **Trigger conditions are specific enough** — your skill should not activate for unrelated prompts
- **Answers are accurate** — compare Claude's response against the source material in your SKILL.md and references

### Step 4 — Iterate

Each time you edit your skill:

```bash
./scripts/install-local.sh   # Re-install (overwrites previous version)
```

Then start a new Claude Code session to pick up the changes. Repeat until the skill behaves as expected.

### Quick testing checklist

- [ ] All five `npm run` checks pass (validate, lint-markdown, verify-refs, security-audit, size-report)
- [ ] Skill activates on relevant prompts
- [ ] Skill does **not** activate on unrelated prompts
- [ ] Reference files load correctly when deeper detail is needed
- [ ] Answers match the content in your SKILL.md and references

## Key Files Reference

| File | Purpose |
|------|---------|
| `.claude-plugin/marketplace.json` | Root catalog — lists installable plugins |
| `.claude-plugin/plugin.json` | Plugin manifest — name, version, skills list |
| `.cursor-plugin/plugin.json` | Cursor plugin manifest — plugin `vechain` (Claude uses `vechain-ai`); `version` must match `.claude-plugin/plugin.json` |
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
- [ ] VeChain-specific skills are registered in `.cursor-plugin/plugin.json`
- [ ] Cross-references between files use correct relative paths

## Content Sources

- [VeChain Documentation](https://docs.vechain.org/)
- [VeChain Kit Documentation](https://docs.vechainkit.vechain.org/)
- [VeChain SDK](https://github.com/vechain/vechain-sdk-js)
- [VeBetterDAO Documentation](https://docs.vebetterdao.org/)
- [StarGate Documentation](https://docs.stargate.vechain.org/)
