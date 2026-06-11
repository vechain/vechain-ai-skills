# Judging rubric — "does this result make sense?"

This is the intellectual core of the skill. A click produces a new screen; your job is to decide
whether that screen is **correct**, a **minor nit**, or a **suspected defect** — and to do it
without crying wolf. The trap is treating "unexpected to me" as "broken." Anchor every judgment in
two oracles:

1. **Project intent** — what the repo says the app should do (your intent brief: purpose, users,
   critical flows, what "correct" looks like). When unsure, go back to the code: the component, the
   route handler, the validation schema, the copy in the source.
2. **Persona expectation** — what the user you're impersonating reasonably expected to happen.

A result is a **defect only when it violates one of these oracles**, not merely when it surprises
you. If you can't articulate which oracle it breaks, it's probably not a finding.

## Anomaly categories (what to look for)

- **Functional** — action does nothing, does the wrong thing, or the opposite of its label; flow
  can't be completed; data submitted doesn't appear; navigation lands on the wrong place.
- **Errors under the hood** — JS exceptions in the console; 4xx/5xx or failed/hung requests in the
  network log; requests firing that shouldn't, or carrying wrong payloads. These are high-signal
  because they're objective — always read console + network each cycle.
- **State / data integrity** — values inconsistent between views; stale data after an update;
  changes that don't persist across reload; duplicate records from a double-submit; counters that
  drift.
- **Visual / layout** — overlap, clipping, overflow, broken responsive layout, invisible text,
  z-index fights, content under fixed bars, broken images. Judge against the design intent, not
  your taste.
- **Content vs intent** — copy that contradicts what the feature does, wrong/placeholder text in
  production, mislabeled buttons, broken i18n (missing keys, untranslated strings), wrong
  currency/format.
- **Performance / responsiveness** — no loading state, UI frozen during work, spinner that never
  resolves, action that takes implausibly long.
- **Accessibility** — unfocusable controls, no focus ring, missing labels/alt, contrast failures,
  modals without focus trap, content breaking at 200% zoom.
- **Robustness / edge cases** — long/unicode/whitespace input breaking layout or validation; the
  app accepting clearly-invalid input or rejecting clearly-valid input; broken state after
  Back/refresh mid-flow.

## Expected vs defect — don't cry wolf

Before flagging, rule out the boring explanations:

- **Working as designed.** Re-derive intent from the repo. A confirmation dialog, a validation
  rejection, a feature gated behind a plan — these are usually *correct*. If the code says it
  should happen, it's not a bug.
- **Transient.** Slow network, a still-loading state, a one-off hiccup. Re-observe (re-screenshot,
  wait) before deciding. Reproduce from a known state if you can.
- **Your mistake.** A misclick, wrong coordinates, acting before the page settled. Verify you did
  what you think you did.
- **Environment.** Dev-only warnings, seeded/empty test data, feature flags off in this env. Factor
  in the env (prod/staging/dev) from setup.

If it survives all four, it's a genuine **suspected defect** → record a candidate finding. The
adversarial validator (Phase 4) will pressure-test it again before anything is reported.

## Severity scale

- **Critical** — a critical flow (per the intent brief) is broken, data loss/corruption, security
  exposure, or the app is unusable for a whole persona. Report immediately, don't wait for the
  digest.
- **High** — a core feature is broken or wrong for common users; clear functional bug with easy
  repro.
- **Medium** — a real defect with a workaround, or affecting a secondary flow / one persona.
- **Low** — minor visual/copy/UX nits, edge-case-only issues, cosmetic.

Severity feeds reporting cadence and ordering — see [reporting.md](reporting.md).

## What to capture for every candidate finding

Enough that someone (and the validator) can judge it cold:

- Persona, env, and page/URL.
- **Repro steps from a known state** — not "I clicked something," but the sequence to get there.
- **Expected** (cite the oracle: intent brief or persona) vs **actual**.
- Screenshot path (saved with `save_to_disk: true`).
- Relevant console / network lines.
- Provisional severity + category.
- One line: *which oracle does this violate, and why.*
