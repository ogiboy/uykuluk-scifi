# Operator Workflow

```sh
pnpm producer init
pnpm producer ideas
pnpm producer approve idea --run <run_id> --idea <idea_id>
pnpm producer script --run <run_id>
pnpm producer review script --run <run_id>
pnpm producer approve script --run <run_id>
pnpm producer package --run <run_id>
pnpm producer estimate --run <run_id>
pnpm producer evidence --run <run_id>
pnpm producer readiness --run <run_id>
```

Stop after every approval point and inspect the saved artifacts before continuing.

Script approval is content-addressed: review stores the `script.md` SHA-256 digest, approval records
that digest, and packaging fails closed if the file changes after review or approval. After editing
the script, rerun review before approving it.

Canonical inspection files include `state.json`, `ledger.jsonl`, `costs/ledger.jsonl`,
`reviews/script_review.json`, `costs/estimate.json`, `evidence_bundle.json`, and
`diagnostics/readiness.json`.

Current readiness does not yet validate prompt provenance or schema/atomic-write integrity, and its
budget check is still limited to cost-estimate artifact presence. Treat those as open hardening
gaps, not as proven guarantees.
