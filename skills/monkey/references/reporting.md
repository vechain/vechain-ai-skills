# Reporting — channel validation, finding schema, message formats

The report is the product. A run that finds real bugs but can't deliver them, or buries them in
noise, has failed. Two principles: **prove the channel works before you start**, and **send signal,
not a firehose**.

## Channel validation (Phase 1, before any testing)

Send a test message and confirm delivery before exploring. Pick the connected channel:

- **Slack:** use the Slack MCP `send_message`. Ask the user which channel/DM (or search channels).
- **Telegram:** use the Telegram channel. If it isn't paired/configured yet, point the user at the
  Telegram configure/access skills first.

Test message:

```
🐒 Monkey test starting
• Target: <URL>  • Env: <prod/staging/dev>
• Intensity: <tier> (~<rate> tok/min target, budget <N> tokens / <M> cycles)
This is a delivery test — no action needed. Confirmed findings will arrive here.
```

Then verify it landed (ask the user to confirm, or check the send result). **If it fails, stop and
fix the channel** — do not run a test whose output can't be delivered. Default delivery is
**streaming**: each confirmed finding is sent as it clears validation (deduped against the channel
first), with a summary at the end. Confirm this with the user if they seem to expect a single
end-of-run digest instead.

## Candidate finding schema (internal, pre-validation)

Keep candidates in this shape so the validator and the report can both consume them:

```json
{
  "id": "F-001",
  "title": "short imperative summary",
  "severity": "critical|high|medium|low",
  "category": "functional|errors|state|visual|content|performance|accessibility|robustness",
  "persona": "which persona triggered it",
  "env": "prod|staging|dev",
  "url": "page where it happened",
  "repro_steps": ["from a known state", "step 2", "..."],
  "expected": "what should happen (+ which oracle: intent brief or persona)",
  "actual": "what happened",
  "screenshot": "path saved via save_to_disk",
  "evidence": "relevant console/network lines",
  "oracle_violated": "one line: which rule of intent/persona this breaks",
  "validation": { "verdict": "...", "confidence": 0.0, "reasoning": "...", "corrected_severity": "..." }
}
```

## Reporting cadence — stream each confirmed finding, deduped

- **Report as you go.** The moment a finding's validator returns `confirmed`, report it — don't
  hold it for an end-of-run batch. Validation runs in parallel, one per finding (see
  `adversarial-validation.md`), so confirmed reports naturally trickle out during the run.
- **Dedup first (see below).** Before every send, check the channel for an existing report of the
  same defect and skip if it's already there.
- **Criticals stand alone, immediately.** A broken critical flow goes out on its own the instant
  it's confirmed.
- **One message per genuinely new finding.** Streaming is not a firehose: still collapse the same
  defect seen on multiple pages into a single report, and prefer substance over one-liner pings.
- **Never send unconfirmed candidates** as defects. They belong only in the run summary's
  "unconfirmed / needs human eyes" list.

## Deduplicate against the channel (before every send)

The channel is shared and long-lived: it may already carry a report of the same bug from a previous
run, from a teammate, or from earlier in this run. Reporting it again is noise that erodes trust, so
**every send is gated on a dedup check:**

1. **Read recent channel history** for the same defect — Slack: `search_messages` or read the
   channel; Telegram: read recent messages; file/webhook: scan the existing report file. Search by
   the symptom and the page/URL, not your exact wording (e.g. "undefined in search empty state",
   "agent detail title", "double-submit checkout").
2. **Match on substance, not phrasing.** Same defect + same page/flow ⇒ duplicate, even if the
   severity, persona, or steps differ.
3. **If a match exists, skip the send.** Log it in your run as "already reported — skipped (link)";
   at most react to / ▲ the existing message if the channel supports it, rather than reposting.
4. **If it's a recurrence of something marked fixed/closed,** reply *in that message's thread*
   ("still reproduces as of `<date>`") instead of opening a new top-level report.
5. **When unsure, err toward not pinging twice** — one consolidated note beats a duplicate.

## Confirmed-finding message format

```
🐒🔴 [CRITICAL] <title>
Env: <env> · Persona: <persona> · Page: <url>

Repro (from <known state>):
1. <step>
2. <step>

Expected: <expected> (oracle: <intent/persona>)
Actual:   <actual>

Evidence: <key console/network line>
Validator: confirmed (<confidence>) — <one-line reasoning>
Screenshot: <attached / path>
```

Use the severity emoji/label to sort attention: 🔴 critical, 🟠 high, 🟡 medium, ⚪ low. Attach the
screenshot where the channel supports it; otherwise include the saved path.

## End-of-run summary

Always close with a digest the user can scan:

```
🐒 Monkey run complete — <URL> (<env>)
Cycles: <n> · Personas: <list> · Tokens spent: ~<n> / budget <n>
Candidates: <n> → Confirmed: <n> · Filtered (false positive): <n> · Skipped (already reported): <n> · Unconfirmed: <n>

Confirmed findings: <list with severities, linking to the messages sent during the run>
Skipped as duplicate: <one line each: finding + link to the existing channel report>
Filtered (audit): <one line each: finding + why the validator rejected it>
Unconfirmed (needs human eyes): <list>
Coverage gaps / what I'd hit next: <areas not reached, flows blocked by auth/destructive walls>
```

The "filtered" and "coverage gaps" sections matter: they let the user audit what the antagonist
threw out and see honestly what the run did **not** cover (silent truncation reads as "everything's
fine" when it isn't).
