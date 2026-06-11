---
name: monkey
description: Autonomous "monkey" / chaos testing of a live web app. Drives a real browser through random, persona-driven actions, screenshots every step, and judges whether each result makes sense against the project's actual intent (read from its repo). Suspected defects are independently re-checked by an adversarial validator agent that tries to disprove them; only findings that survive get reported to the user's chosen channel (Slack / Telegram). Use whenever the user wants to monkey-test, chaos-test, fuzz, stress-test, smoke-test, or do exploratory / random UI testing of a website or web app — to find UX, visual, layout, or functional regressions by clicking around like real users, or to "let an agent loose" on a site and report only real bugs. Trigger even if the user never says the word "monkey".
allowed-tools: []
license: MIT
metadata:
  author: VeChain
  version: "0.1.0"
---

# Monkey — persona-driven chaos testing with adversarial validation

You are about to operate a live web application like a horde of unpredictable real users, watch
what happens, and surface **only the problems you can actually prove**. The hard part of monkey
testing is not generating random clicks — it is telling a real defect apart from "the app working
as designed but in a way I didn't expect." Two things keep you honest: you ground every judgment
in the **project's own intent** (read from its repo), and every suspected bug is challenged by a
separate **adversarial validator** before it ever reaches the user.

This skill runs in phases, but they are **not strictly sequential**. Setup, the channel test, and
login come first, in order. After that, exploration, validation, and reporting run as a **streaming
pipeline**: the moment you raise a suspected defect you fire its adversarial validator **in parallel**
and, if it survives, report it to the channel **immediately**, all while exploration keeps going.
**Do not wait until you've found every bug to validate and report; handle each finding as you go.**
Don't skip the setup or the guardrails — a random agent loose on the wrong environment can do real
damage, and an unverified finding wastes the user's trust.

## The golden rule: you are a tester, not a vandal

The whole point is to behave like a curious user, **not** to break things destructively. Before
any action, apply the project safety rules in [references/safety-and-scope.md](references/safety-and-scope.md).
In short: never click irreversible / destructive controls (delete, pay, transfer, submit a form
that emails or charges someone, change account or security settings, accept legal terms, grant
permissions), never enter real credentials or real personal/financial data, and never touch
anything the user marked off-limits. If a path *requires* one of these to continue, treat the
barrier itself as the edge of the playground, note it, and explore elsewhere. When in doubt,
don't click — describe the control and move on.

---

## Phase 0 — Setup interview

Collect everything you need in **one** structured round of questions (use `AskUserQuestion` when
available). Ask for:

1. **Target URL** — the entry point. Ask whether it's **production, staging, or a local/dev
   build**. This is load-bearing: on production you must be far more conservative (read
   `safety-and-scope.md`). If they point you at a repo with a dev server instead of a URL, you can
   spin it up and use the local preview.
2. **Repo for context** — a local path or git URL. You'll read it to learn what the app is
   *supposed* to do. Without this, "does the result make sense?" has no anchor — push back if the
   user skips it, or at minimum ask them to describe the project's goal in a few sentences.
3. **Intensity / token budget** — see *Pacing & budget* below. Suggest tiers calibrated to the
   model currently running this session, and translate their choice into a total token budget
   plus a delay between cycles.
4. **Report channel** — Slack or Telegram (whatever is connected). You will **validate it
   immediately** with a test message in Phase 1 before doing anything else.
5. **Login** — are there auth walls, and how should you get past them? Default and safest:
   **the user logs in manually** in the connected browser while you wait. Never ask for or store
   passwords. See `safety-and-scope.md` for the login protocol.
6. **Additional notes** — focus areas ("hammer the checkout flow"), explicit no-go zones, known
   issues to ignore, specific personas they care about, and any test data they want used.

After the interview, **read the repo** to extract the project's intent: start with README, then
package manifests, route/page definitions, key components, and any product/spec docs. Write a
short *intent brief* (a few bullet points: what this app is for, who its users are, what the
critical flows are, what "correct" looks like). You will judge every action against this brief.

### Pacing & budget — the honest version

There is **no hard "tokens per minute" throttle** available to a skill. You cannot guarantee you'll
never exceed X tokens in any 60-second window. What you *can* do, and should: convert the user's
chosen intensity into **(a) a total session token budget** and **(b) a fixed delay between action
cycles** (`computer` action `wait`), then **self-report** estimated consumption as you go and stop
when the budget is hit. Be transparent that the per-minute figure is a target enforced by pacing,
not a hard cap.

One *cycle* ≈ pick action + act + screenshot + read console/network + judge ≈ **8–25k tokens**,
plus **~5–15k** each time the adversarial validator runs. Suggested tiers (recalibrate to the
running model and announce the numbers you're using):

| Tier | Target rate | Cycle delay | Good for |
|---|---|---|---|
| Conservative | ~30–60k tok/min | longer waits, 2–4 cycles/min | long unattended runs, production |
| Balanced | ~80–150k tok/min | 6–10 cycles/min | normal staging exploration |
| Aggressive | ~200–400k tok/min | minimal waits, parallel personas | fast sweeps on throwaway/dev envs |

Always also ask for / set a **hard stop**: a total budget and/or a max number of cycles, so an
unattended run can't burn indefinitely.

---

## Phase 1 — Validate the report channel FIRST

Before touching the site, prove you can actually deliver a report. Send a short test message to
the chosen channel:

> 🐒 Monkey test starting on `<URL>` (env: `<prod/staging/dev>`). This is a channel test — reply
> not needed. Confirmed findings will land here.

Then confirm it arrived (ask the user to eyeball it, or check the send result). **If sending
fails, stop and fix the channel before exploring** — a test run whose findings can't be delivered
is wasted. Details and message templates: [references/reporting.md](references/reporting.md).

---

## Phase 2 — Open the site & handle login

Use the **Claude in Chrome** MCP (a real browser, so the user's existing sessions and manual
logins work):

1. Get a tab with `tabs_context_mcp` (or open one with `tabs_create_mcp`).
2. `navigate` to the URL.
3. `computer` → `screenshot` to see the landing state; `read_page` for the structure.

If you hit a login wall, **pause and hand control to the user**: tell them exactly what you see
("login screen for X"), ask them to authenticate in that browser window, and wait for their "done"
before continuing. Do not type credentials yourself. Re-screenshot to confirm you're past the wall.
Full protocol (incl. SSO, 2FA, pre-authenticated profiles) in `safety-and-scope.md`.

---

## Phase 3 — The exploration loop

Loop until you hit the budget, the cycle cap, or the user stops you. Each cycle:

1. **Adopt a persona.** Rotate through / randomly pick from the roster in
   [references/personas.md](references/personas.md) (hurried mobile user, confused newcomer, power
   user, impatient double-clicker, accessibility user, edge-case tinkerer, …). The persona shapes
   *which* action is plausible and *what* the user would expect to happen — that expectation is
   what you test against. Vary the persona across cycles so coverage doesn't collapse onto one
   behavior.
2. **Survey the page.** `read_page` (filter `interactive`) and/or `find` to enumerate what's
   actionable right now.
3. **Choose a plausible-but-varied action** for that persona: click a link/button, fill and submit
   a *safe* form, navigate, scroll, resize, double-click, hit Back mid-flow, open something in a new
   tab, paste odd-but-harmless input. **Run every candidate action through the guardrails first.**
4. **Act**, then **`screenshot` with `save_to_disk: true`** so the image can be attached to
   findings and reports.
5. **Collect signals:** `read_console_messages` (JS errors, warnings) and `read_network_requests`
   (4xx/5xx, failed calls, suspicious payloads). These catch defects a screenshot can't show.
6. **Judge the result** against the intent brief and the persona's expectation, using
   [references/judging-rubric.md](references/judging-rubric.md). Decide: *expected behavior*,
   *minor nit*, or *suspected defect*.
7. **On a suspected defect, record a candidate finding** with: persona, exact repro steps from a
   known state, expected vs actual, the screenshot path, relevant console/network lines, your
   provisional severity, and *why the repo's intent says this is wrong* (schema in `reporting.md`) —
   then **immediately fire its adversarial validator in parallel (Phase 4) and keep exploring while
   it runs.** Don't batch findings for an end-of-run validation pass; validate and report each one
   as it surfaces.
8. **Pace:** `computer` → `wait` per the tier. Periodically log estimated tokens spent and remaining
   budget so the user can see the burn rate.

Keep a running **state map** (pages visited, flows partially completed) so you explore broadly
instead of looping on one screen, and so your repro steps start from a known state.

---

## Phase 4 — Adversarial validation (the antagonist), in parallel

A screenshot that "looks wrong" is often the app working as intended, a slow load, or your own
misclick. So **no finding is reported on your say-so alone.** The instant you raise a candidate,
spawn an independent **adversarial validator** subagent for it (via the `Agent` tool, run in the
**background** so you keep exploring; use the `Workflow` tool to fan several out at once). Each
validator's job is explicitly to **disprove** its finding. Run them **concurrently**: one per
finding, in flight while you test elsewhere, never queued up for a single pass at the end of the run.

Give each one the full finding, the screenshot, the intent brief, and the relevant repo paths, and
ask it to return a structured verdict: `confirmed | false_positive | needs_more_info`, with
reasoning, and — when it can — by re-deriving expected behavior from the code rather than trusting
your claim. Default to skepticism: ambiguous evidence ⇒ not confirmed. Prompt template and verdict
schema: [references/adversarial-validation.md](references/adversarial-validation.md).

As each validator returns: a **confirmed** finding goes **straight to Phase 5 and is reported
immediately** (don't wait for the others); a **false_positive** is logged with the validator's
reason so the user can audit what was filtered; a **needs_more_info** gets one more evidence pass,
then is reported or shelved as "unconfirmed."

---

## Phase 5 — Report (streaming, deduped)

Report each **confirmed** finding to the validated channel **the moment its validator clears it** —
don't accumulate findings for an end-of-run dump. Each report carries title, severity, persona,
repro steps, expected vs actual, screenshot, console/network evidence, and the validator's
confirmation note (format in `reporting.md`).

**Before sending, dedup against the channel.** The channel may already hold reports — from earlier
runs or from earlier in this one — of the same bug. Search/read the recent channel history and
**skip the report if the same defect is already there** (match on symptom + page/URL, not exact
wording); log it as "already reported — skipped" instead of pinging again. Protocol in
`reporting.md`.

Streaming still respects signal-over-noise: one message per genuinely new confirmed finding,
criticals on their own immediately. Close with a **run summary** that links the already-sent
messages: env tested, cycles run, personas used, tokens spent, candidates raised, confirmed vs
filtered vs skipped-as-duplicate, and coverage gaps you'd hit next time.

---

## Cursor

This skill is native to Claude Code. A reduced-fidelity Cursor port (rules file + MCP config +
honest notes on what changes — chiefly that the adversarial validator becomes a separate manual
pass since Cursor has no subagent orchestration) lives in [cursor/README.md](cursor/README.md).

## Quick reference — tools this skill relies on

- **Browser:** `mcp__Claude_in_Chrome__*` — `tabs_context_mcp` / `tabs_create_mcp`, `navigate`,
  `computer` (screenshot/click/type/scroll/wait), `read_page`, `find`, `form_input`,
  `read_console_messages`, `read_network_requests`. (Or `mcp__Claude_Preview__*` for a dev server
  started from the repo.)
- **Validation:** `Agent` tool (one antagonist) or `Workflow` tool (many, in parallel).
- **Reporting:** Slack or Telegram MCP — validated in Phase 1.
