# Operator Workflow

```sh
pnpm producer init
pnpm producer ideas
pnpm producer approve idea --run <run_id> --idea <idea_id>
pnpm producer script --run <run_id>
pnpm producer revise script --run <run_id> --file <path> --reason "<reason>" --editor <name>
pnpm producer review script --run <run_id>
pnpm producer approve script --run <run_id>
pnpm producer package --run <run_id>
pnpm producer estimate --run <run_id>
pnpm producer approve cost --run <run_id> # only when evidence reports approvalRequired=true
pnpm producer evidence --run <run_id>
pnpm producer readiness --run <run_id>
```

Stop after every approval point and inspect the saved artifacts before continuing.

Script approval is content-addressed: review stores the `script.md` SHA-256 digest, approval records
that digest, and packaging fails closed if the file changes after review or approval. Do not edit
`script.md` directly. The revision command records before/after snapshots, attribution, reason, and
hashes; it invalidates stale script review/approval and returns the run to `SCRIPT_GENERATED`.
Review and approve the revised script again before packaging.

Canonical inspection files include `state.json`, `ledger.jsonl`, `costs/ledger.jsonl`,
`reviews/script_review.json`, `revisions/script/`, `costs/estimate.json`, `evidence_bundle.json`,
and `diagnostics/readiness.json`.

Current readiness strictly validates the versioned cost quote, production-package digest, relevant
config, enabled stage pricing, and live hard budgets. Above-threshold quotes require an approval
whose `approvedRef` matches the exact persisted quote SHA-256 digest. Cost approval does not execute
or authorize a paid provider; paid execution remains disabled. Run state is schema-validated and
JSON writes use atomic replacement. Ideas, scripts, and production packages load tracked
`.ai/prompts/` defaults through typed runtime templates. Evidence records the source path and actual
rendered prompt SHA-256 hash.

After readiness passes, `state.json`, `diagnostics/readiness.json`, and `evidence_bundle.json` must
all report `READY_FOR_MANUAL_PRODUCTION`.
