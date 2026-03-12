# Event Pipeline

Use this reference when the user needs event decoding or business-event guidance.

## Event Stack

The library's event pipeline is built around `CombinedEventProcessor` and can include:

- ABI event decoding from classpath JSON resources
- synthetic VET transfer events
- business events derived from decoded events

In normal usage, this is configured through `IndexerFactory`.

## ABI Events

ABI files are loaded from the classpath, not arbitrary filesystem paths.

Useful factory options:

- `abis(basePath)`
- `abiEventNames(...)`
- `abiContracts(...)`

If a requested ABI event or function name is missing, loading fails rather than silently ignoring the mismatch.

## Thor-Side Filtering

In log-based mode, filter remote log volume before decoding with:

- `eventCriteriaSet(...)`
- `transferCriteriaSet(...)`

This is the most efficient way to narrow log queries.

## VET Transfers

Native VET transfers are represented as synthetic `IndexedEvent` values with:

- `eventType = "VET_TRANSFER"`
- params for `from`, `to`, and `amount`

They can be enabled explicitly with `includeVetTransfers()`.

If a business-event definition depends on `VET_TRANSFER`, transfer decoding is enabled automatically.

## Business Events

Business events are higher-level actions derived from one or more decoded events in the same transaction.

Use them when downstream consumers care about semantic actions such as staking, claims, swaps, or composite flows.

Useful factory options:

- `businessEvents(basePath, abiBasePath)`
- `businessEventNames(...)`
- `businessEventContracts(...)`
- `businessEventSubstitutionParams(...)`

## ABI vs Business Events

Prefer raw ABI events when:

- every decoded event matters individually
- there is no stable semantic grouping

Prefer business events when:

- downstream consumers want domain actions instead of raw logs

When both are configured, ABI events covered by a business event for the same transaction and clause are removed from the final output to avoid double-reporting.
