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
fix the channel** — do not run a test whose output can't be delivered. Ask the user how they want
delivery if it's ambiguous (a single digest at the end vs. live criticals + end digest).

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

## Reporting cadence — signal over noise

- **Critical / broken critical flow:** send immediately, on its own, as soon as the validator
  confirms. Don't make the user wait through a digest for a showstopper.
- **High / medium / low:** batch into a **digest** (end of run, or at sensible checkpoints for long
  runs). A stream of one-line pings trains the user to ignore the channel.
- **Never send unconfirmed candidates** as defects. They belong only in the run summary's
  "unconfirmed / needs human eyes" list.

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
Candidates raised: <n> → Confirmed: <n> · Filtered (false positive): <n> · Unconfirmed: <n>

Confirmed findings: <list with severities, linking to the messages above>
Filtered (audit): <one line each: finding + why the validator rejected it>
Unconfirmed (needs human eyes): <list>
Coverage gaps / what I'd hit next: <areas not reached, flows blocked by auth/destructive walls>
```

The "filtered" and "coverage gaps" sections matter: they let the user audit what the antagonist
threw out and see honestly what the run did **not** cover (silent truncation reads as "everything's
fine" when it isn't).
