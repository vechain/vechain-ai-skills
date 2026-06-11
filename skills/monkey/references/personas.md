# Personas

A monkey test is only useful if the "monkey" behaves like the messy variety of real humans. Each
persona changes two things: **which action is plausible next**, and **what the user would expect
to happen**. That expectation is the yardstick you judge the result against — a flow that's fine
for a power user can be a defect for a confused newcomer, and vice versa.

Rotate personas across cycles. Don't let coverage collapse onto one behavior; a run that only ever
acts as "happy-path power user" misses most real bugs. You can also blend traits ("hurried mobile
newcomer") and invent new personas that fit the specific app from the intent brief.

For each cycle, pick a persona, then ask: *what would THIS person try here, and what would they
expect?* Act, observe, and judge the gap.

## Roster

- **Hurried mobile user.** Small viewport (resize the window narrow), thumbs, impatient. Taps
  fast, scrolls aggressively, abandons slow things. Surfaces: tap targets too small, layout
  breakage at mobile widths, content hidden behind fixed bars, slow first paint, sticky elements
  overlapping inputs.

- **Confused newcomer.** First visit, doesn't know the jargon, no mental model. Clicks the most
  prominent thing, reads labels literally, gets lost. Surfaces: unclear CTAs, dead ends, missing
  empty-states, no onboarding, confirmations that don't explain consequences, jargon with no
  affordance.

- **Power user / speedrunner.** Knows the app, wants the shortest path. Keyboard nav, opens things
  in new tabs, deep-links, uses Back/Forward mid-flow, multi-tab. Surfaces: broken keyboard
  support, state lost on Back, deep links that 404, race conditions from fast actions, focus traps.

- **Impatient double-clicker.** Clicks twice when something is slow; resubmits forms; hits the
  button again before the spinner resolves. Surfaces: double-submit / duplicate records, missing
  loading/disabled states, idempotency bugs, double-charge-shaped issues (observe only — never
  actually pay).

- **Accessibility user.** Keyboard-only and/or screen-reader mental model; zooms to 200%. Tabs
  through everything. Surfaces: unfocusable controls, no visible focus ring, missing labels/alt
  text, poor contrast, content that breaks or clips on zoom, modals that don't trap focus.

- **Edge-case tinkerer.** Curious, pokes boundaries — *within the guardrails*. Pastes very long
  strings, emoji/RTL/unicode, leading spaces, whitespace-only, numbers where text is expected,
  rapid back-navigation, opening the same modal repeatedly, resizing during animations. Never
  enters real data and never crosses the destructive-action line. Surfaces: validation gaps,
  overflow/truncation, encoding bugs, broken state machines.

- **Distracted / interrupted user.** Starts a flow, navigates away mid-way, comes back, refreshes,
  or leaves a tab idle then returns. Surfaces: lost form state, stale data, broken resume,
  session-expiry handled badly, optimistic UI that never reconciles.

- **Returning user.** Has prior state (logged in, items in a list, saved settings). Re-enters
  flows expecting their context preserved. Surfaces: state not persisted, cache staleness,
  inconsistent data between views, settings that silently reset.

## Using personas to generate actions

1. From `read_page`/`find`, list what's actionable right now.
2. Filter to what *this persona* would plausibly do next (a newcomer clicks the big obvious CTA; a
   power user reaches for a keyboard shortcut or a deep link).
3. Pick one, varying from recent cycles to widen coverage.
4. Write down the persona's **expectation** before acting — that's your test oracle for the judging
   step.
