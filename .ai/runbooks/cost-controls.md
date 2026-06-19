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
readiness and reservation. Active `RESERVED`, `SETTLEMENT_PENDING`, and `UNCERTAIN` amounts count
against those budgets.

Future paid-adapter sequence:

1. Call `reserveApprovedCost` immediately before submitting the provider request.
2. If the request was definitely not submitted, release the reservation. The quote line remains
   consumed and a retry needs a new quote and approval.
3. If submission may have occurred but the outcome is unknown, mark the reservation uncertain.
4. Settle a confirmed charge using integer USD micros. A pending settlement is safe to retry.
5. Explicitly reconcile every uncertain outcome to settled or released with an operator reason.

No current CLI command or provider adapter invokes this lifecycle. Paid execution remains disabled.
