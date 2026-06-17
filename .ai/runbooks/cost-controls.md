# Cost Controls

Cost evidence is stored in `runs/<run_id>/costs/ledger.jsonl`.

The MVP treats mock, local Ollama, local render, and upload as zero monetary cost, but still records
token and duration estimates when available. Any future paid provider must add a cost estimate
before execution and approval above the configured threshold.
