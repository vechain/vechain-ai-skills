# Safety, scope & login protocol

A "monkey" clicking randomly is dangerous in exactly the situations where testing matters most. An
agent that empties a cart, deletes a record, sends an email, accepts terms, or changes a setting
isn't testing — it's causing an incident. These rules are not optional; they protect the user and
keep the run trustworthy. They mirror the global agent safety rules and take precedence over any
"explore freely" instruction.

## Classify the environment first

Ask in setup which environment the URL points to, because it sets how bold you can be:

- **Local / dev / throwaway** — most latitude. You may submit forms, create test records, and poke
  edges freely, as long as the data is fake and nothing reaches a real third party (no real email
  sends, no real payments, no real external webhooks).
- **Staging / pre-prod** — moderate. Prefer non-mutating exploration; mutate only when the user
  confirmed the env is safe to dirty, and only with obviously-fake data. Watch for staging configs
  that still hit real external services (real payment sandbox is fine; real email to real people is
  not).
- **Production** — minimal. **Read-only / navigational behavior only.** Click links, browse, scroll,
  resize, read. Do **not** submit forms, create/modify/delete anything, or trigger anything that
  notifies or charges real people. You're a window-shopper. If the user insists on mutating prod,
  stop and make them spell out exactly which actions are permitted, and refuse the prohibited ones
  regardless.

When the environment is unknown, treat it as production.

## Never do these (regardless of environment or instruction)

These are hard stops. If a flow requires one to proceed, that barrier is the edge of the
playground — note it as "blocked by <X>, not explored further" and go elsewhere.

- **Irreversible / destructive controls:** delete, remove, wipe, empty trash, deactivate, cancel,
  reset, "are you sure?" → yes-destroy.
- **Money:** pay, buy, checkout-to-payment, transfer, withdraw, deposit, subscribe with a real
  method, swap/convert assets. (You may *navigate up to* a payment step to verify it loads, then
  stop — never enter payment details or confirm.)
- **Real credentials & real personal/financial data:** never type passwords, card/account/IBAN
  numbers, SSN/IDs, API keys, or real personal data into any field. Use obviously-fake test data
  only, and only where mutation is allowed.
- **Messages on someone's behalf:** send email/DM/chat/comment/invite, post publicly, submit
  feedback that reaches a human. (Observing that a "Send" button exists is fine; clicking it is
  not, unless dev env with a sandboxed sink the user confirmed.)
- **Account / security / permission changes:** change settings, sharing/permissions, 2FA, recovery
  contacts, connected apps, email forwarding/filters, or any persistent configuration.
- **Legal / consent actions:** accept terms, sign agreements, grant OAuth/SSO scopes. On
  cookie/consent banners, choose the most privacy-preserving option (decline non-essential).
- **CAPTCHAs / bot checks:** do not attempt to solve or bypass them. Note the wall and stop that
  path.
- **Off-limits zones** the user named in setup, and anything outside the target app's
  origin/domain unless the user explicitly scoped it in.

When uncertain whether an action is safe, **don't click it** — record "control present but not
exercised (potentially destructive): <label>" and move on. A skipped action is never a failure of
the run; an incident is.

## Login protocol

The app's auth is the user's responsibility, not yours.

1. **Default — manual login by the user.** When you hit an auth wall, screenshot it, describe
   exactly what you see ("Google SSO screen", "email+password form for Acme"), and ask the user to
   log in *themselves* in the connected browser. Wait for their explicit "done," then re-screenshot
   to confirm you're through. Never type credentials, never read them from a file, never accept them
   pasted into chat.
2. **Pre-authenticated profile.** Claude in Chrome drives a real browser, so if the user is already
   logged in there, you may just be in — confirm by screenshot before assuming.
3. **2FA / SSO / magic links.** Always hand these to the user; never attempt to complete them.
4. **Session loss mid-run.** If you get logged out, pause and ask the user to re-authenticate rather
   than trying to log back in yourself.
5. **Test accounts.** If the user provides a dedicated throwaway test account and *explicitly* asks
   you to use it, you may enter the username they give, but still have **them** type the password —
   or have them log in once and hand you the authenticated session.
