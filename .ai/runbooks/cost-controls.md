# Cost Controls

Cost evidence is stored in `runs/<run_id>/costs/ledger.jsonl`. Reservation lifecycle events are
stored separately in `runs/<run_id>/costs/reservations.jsonl`.

The MVP treats mock, local Ollama, local render, and upload as zero monetary cost, but still records
token and duration estimates when available. Future paid production stages use a versioned quote
bound to the run, production package, relevant config, enabled stage pricing, budgets, and exact
persisted JSON-plus-Markdown quote digest. Quotes above the configured threshold require
`producer approve cost`.

Cost approval is review evidence only. It does not call a provider, reserve budget, or authorize
repeated spending. The internal reservation service can consume one enabled nonzero quote line after
successful readiness. It infers provider, model, and maximum cost from the approved quote; callers
cannot supply them.

Per-video, daily, and weekly hard budgets cannot be overridden by approval and are rechecked at
readiness and reservation. Active `RESERVED`, `EXECUTION_STARTED`, `SETTLEMENT_PENDING`, and
`UNCERTAIN` amounts count against those budgets.

Future paid-adapter sequence:

1. Call the internal `executeReservedProviderOperation` boundary with an adapter whose provider and
   model match the approved quote.
2. The boundary reserves the quote and atomically persists `EXECUTION_STARTED` before callback
   entry. Same-operation retries cannot invoke the callback again.
3. If the adapter proves the request was not submitted, release the reservation. The quote line
   remains consumed and a retry needs a new quote and approval.
4. If submission may have occurred, callback metadata is malformed, the callback throws, or the
   timeout expires, keep the reservation uncertain.
5. Settle a confirmed charge using integer USD micros and a SHA-256 hash of any bounded provider
   request id. A pending settlement is safe to retry.
6. Explicitly reconcile every uncertain outcome to settled or released with an operator reason.

No real provider adapter, paid SDK, credential, or CLI command invokes this lifecycle. The internal
contract is tested; paid execution remains disabled.
