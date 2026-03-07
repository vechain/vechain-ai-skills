# VeChain AI — Repo Development Guidelines

## Repository Structure

```
.claude-plugin/
  marketplace.json            # Plugin marketplace catalog
  plugin.json                 # Plugin manifest (name, version, skills)
skills/                       # One directory per skill
  vechain-dev/
    SKILL.md                  # Skill content with YAML frontmatter
    references/               # Supplementary reference files
scripts/                      # Validation and install scripts
```

## Distribution

Three channels — all must stay in sync:

1. **Claude Code marketplace**: `.claude-plugin/marketplace.json` + `.claude-plugin/plugin.json`
2. **Skills CLI**: `SKILL.md` files are auto-discovered by `npx skills add`
3. **Local install**: `scripts/install-local.sh` copies skills to `~/.claude/skills/`

## Skill Conventions

- Each skill lives in `skills/<skill-name>/` with a `SKILL.md` and optional `references/` directory
- `SKILL.md` must have YAML frontmatter with `name`, `description`, `license`
- `name` in frontmatter must match the directory name
- Reference files are loaded on demand via progressive disclosure table in SKILL.md

### SKILL.md Frontmatter

```yaml
---
name: skill-name
description: Short description
allowed-tools: []
license: MIT
metadata:
  author: VeChain
  version: "0.1.0"
---
```

### Adding a New Skill

1. Create `skills/<skill-name>/SKILL.md` with frontmatter
2. Optionally add `references/` directory for supplementary files
3. Register in `.claude-plugin/plugin.json` skills array
4. Register in `.claude-plugin/marketplace.json` plugins array (required for `/plugin install` to find the skill)
5. Run `npm run validate` to verify structure

**IMPORTANT:** A skill MUST be added to BOTH `plugin.json` AND `marketplace.json`. Missing `marketplace.json` means `/plugin install <name>` will return "not found".

## Code Style

- Markdown: follow `.markdownlint-cli2.jsonc` rules
- Commit messages: imperative mood, short first line

## Testing Changes

```bash
npm run validate              # Validate plugin structure
npm run lint-markdown          # Lint all markdown
scripts/install-local.sh       # Test local skill installation
```
