# Cost Controls

Cost evidence is stored in `runs/<run_id>/costs/ledger.jsonl`.

The MVP treats mock, local Ollama, local render, and upload as zero monetary cost, but still records
token and duration estimates when available. Future paid production stages use a versioned quote
bound to the run, production package, relevant config, enabled stage pricing, budgets, and exact
persisted JSON-plus-Markdown quote digest. Quotes above the configured threshold require
`producer approve cost`.

Cost approval is review evidence only. It does not call a provider, reserve budget, or authorize
repeated spending. Before any paid provider is enabled, the core must add atomic reservation,
one-time approval consumption, settlement, uncertain-outcome handling, and reconciliation.

Per-video, daily, and weekly hard budgets cannot be overridden by approval and are rechecked at
readiness.
