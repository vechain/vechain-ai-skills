# Adversarial validation — the antagonist

A finding you raised is a hypothesis, not a fact. You found it while in the flow, possibly primed
to see a bug, possibly after a misclick or a slow load. So before anything reaches the user, a
**separate agent that did not see you find it** tries to **tear it down**. Only survivors get
reported. This is what keeps the report signal-rich and the user's trust intact.

## How to run it — fire on raise, in parallel, report on return

Validation is **not** an end-of-run phase. The moment exploration raises a candidate, kick off its
validator and **keep exploring while it runs**:

- **Each finding → its own validator, immediately.** Spawn it with the `Agent` tool in the
  **background** so the exploration loop never blocks on it.
- **Run them concurrently.** Multiple validators in flight at once is the expected state — use the
  `Workflow` tool's adversarial-verify pattern to fan several out when candidates pile up. Never
  collect findings and validate them in a single batch at the end of the run.
- **High-severity findings** get a small panel (2–3 validators), requiring a majority `confirmed` —
  a false "critical" is the most damaging false positive.
- **Route each verdict the instant it returns:** `confirmed` ⇒ dedup-check the channel and report
  now (don't wait for the others); `false_positive` ⇒ log with the reason and drop;
  `needs_more_info` ⇒ one more evidence pass, then resolve.

Give each validator everything it needs to judge **cold**: the finding, the screenshot path, the
intent brief, and the relevant repo paths. Crucially, frame its job as *disproving*, and tell it to
prefer re-deriving expected behavior from the **code** over trusting your narrative.

## Validator prompt template

```
You are an adversarial validator. A monkey-testing agent claims it found a defect in a web app.
Your job is to DISPROVE this finding — assume it is a false positive until the evidence forces you
to conclude otherwise. Be skeptical; ambiguity means "not confirmed."

PROJECT INTENT (what the app is supposed to do):
<intent brief>

REPO (re-derive expected behavior from here — read the relevant component/route/validation/copy
before trusting the claim):
<repo path or git URL + the specific paths most relevant to this finding>

THE CLAIMED FINDING:
- Persona: <persona>
- Environment: <prod/staging/dev>
- Page/URL: <url>
- Repro steps (from a known state): <steps>
- Expected: <expected, with the oracle it's based on>
- Actual: <actual>
- Severity (claimed): <sev>
- Category: <category>
- Screenshot: <path>
- Console/network evidence: <lines>
- Why the reporter thinks it's wrong: <one-liner>

Work through, in order:
1. Could this be working AS DESIGNED? Find the code/spec that defines the intended behavior and
   compare. If the code says this is correct, it's a false positive.
2. Could it be transient (slow load, still-loading state, one-off) rather than a real defect?
3. Could it be the reporter's own error (misclick, acted before settle, wrong expectation)?
4. Could it be environment-specific noise (dev warning, seed data, flag off) rather than a real bug?
5. Only if it survives all four: is the claimed severity right?

Return ONLY this JSON:
{
  "verdict": "confirmed" | "false_positive" | "needs_more_info",
  "confidence": 0.0-1.0,
  "reasoning": "what you checked and why you concluded this — cite code paths if you read them",
  "corrected_severity": "critical|high|medium|low or null",
  "what_would_confirm_it": "if needs_more_info: the specific extra evidence required"
}
```

## Verdict schema

The validator returns the JSON above. Apply it like so:

- **confirmed** → goes into the report (use `corrected_severity` if it overrode yours).
- **false_positive** → do **not** report. Log it (finding + the validator's reasoning) in the run
  log so the user can audit what was filtered and why.
- **needs_more_info** → if cheap, go back into the app and gather exactly the evidence the validator
  asked for, then re-validate once. If still unresolved, list it in the run summary as "unconfirmed,
  needs human eyes" rather than reporting it as a defect.

For high-severity findings, prefer a small panel (2–3 validators) and require a majority `confirmed`
before reporting — a false "critical" is the most damaging kind of false positive.

## Why disprove rather than confirm?

An agent asked to "verify this bug" tends to find reasons it's real (confirmation bias). An agent
asked to **refute** it goes and reads the code, looks for the as-designed explanation, and only
gives up when it genuinely can't knock the finding down. That asymmetry is the point.
