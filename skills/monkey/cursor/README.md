# Monkey on Cursor — porting notes (honest about the gaps)

This skill is native to **Claude Code** (the `SKILL.md` + `references/` above). Cursor has no
"skills" mechanism, no Workflow/subagent orchestration, and no "Claude in Chrome" tool, so a port
is necessarily **reduced fidelity**. Here's exactly what changes and how to set it up.

## What you get vs. what changes

| Capability | Claude Code (native) | Cursor (this port) |
|---|---|---|
| Skill packaging | `SKILL.md` auto-discovered, progressive disclosure | a **project rule** `.cursor/rules/monkey.mdc` |
| Browser control | `Claude in Chrome` MCP (real browser, your logins) | a **browser MCP server** you configure (e.g. Playwright MCP) |
| Adversarial validator | separate subagent via `Agent`/`Workflow`, in parallel | **manual second pass** — see below. No true parallel subagents. |
| Reporting channel | Slack/Telegram MCP | Slack/Telegram **MCP server** or an incoming webhook |
| Token/min pacing | budget introspection + pacing | pacing only; even less budget visibility — set a hard cycle cap |

The biggest honest gap is the **antagonist**. In Claude Code it's an independent agent that never
saw you find the bug, which is what makes the refutation credible. Cursor can't spawn that cleanly,
so you have three options, best first:

1. **Cursor Background Agent** (if you have access) — kick off a separate background agent with the
   validator prompt from `references/adversarial-validation.md`, feeding it only the finding +
   repo, not your reasoning. Closest to native fidelity.
2. **Fresh chat / second pass** — open a new Cursor chat with no run context, paste the validator
   prompt and the finding, and let it try to disprove the bug against the repo.
3. **Inline role-switch** (weakest) — in the same chat, explicitly switch role to "adversarial
   validator, job is to DISPROVE," and re-derive expected behavior from the code. Use only if 1–2
   aren't available; it's the most prone to confirmation bias.

Whichever you use, **only confirmed findings get reported** — the rule below enforces that.

## Setup

1. **Copy the rule and references into your target project:**
   ```
   <your-repo>/.cursor/rules/monkey.mdc          # from cursor/monkey.mdc
   <your-repo>/.cursor/monkey-refs/              # copy SKILL.md's references/ here
   ```
   The rule points at `monkey-refs/` so Cursor can open personas / rubric / guardrails / reporting
   on demand. (Cursor reads `.mdc` rules; plain `.md` references are read as normal files.)

2. **Configure MCP servers** in `<your-repo>/.cursor/mcp.json` — see `cursor/mcp.json.template`.
   You need at minimum a **browser** server. Add **Slack/Telegram** if you want in-channel
   reporting; otherwise the rule falls back to writing a Markdown report file + an optional webhook.

3. **Invoke it.** In Cursor's Agent, reference the rule: `@monkey test the app at <URL>, repo is
   this project`. The rule's `description` also lets Cursor auto-attach it on monkey/chaos/
   exploratory-testing requests.

## Reality checks

- **Browser MCP logins:** unlike Claude in Chrome, a Playwright MCP server drives its own browser
  context, so your existing logins may not carry over. Prefer running it against a profile/storage
  state you've pre-authenticated, or do the manual-login handoff in the MCP browser window.
- **Pacing:** Cursor gives you little token-budget introspection. Lean on a **hard cycle cap** and
  fixed waits between cycles rather than a token target.
- **Safety:** the guardrails in `references/safety-and-scope.md` are non-negotiable on either
  platform. The `.mdc` rule embeds the hard-stops inline so they can't be skipped.
