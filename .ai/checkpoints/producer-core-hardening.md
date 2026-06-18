# Producer Core Hardening

## Objective

Complete the production-quality, local-first, approval-gated UykulukSciFi Producer core while
keeping paid generation, render, upload, and public/scheduled publish fail-closed. Continue in
coherent, tested slices until the safe core and its evidence contracts are genuinely complete.

## Completion Criteria

- Required CLI workflow, approvals, safeguards, persistence, provider diagnostics, evidence, and
  readiness contracts are implemented and documented.
- Prompt and artifact edits leave attributable durable evidence and invalidate stale approvals.
- `pnpm check`, `pnpm qa:usage`, `pnpm version:plan`, and relevant security/dependency gates pass.
- Changes are committed in coherent Conventional Commit slices.
- Remaining future work is explicitly roadmap-scoped rather than silently incomplete.

## Current State

- Branch/worktree: `fix/core-script-approval-integrity` at
  `/Users/ogiboy/.codex/worktrees/94cb/uykuluk-scifi`.
- Last completed slice: `fcc5f9a feat(cli): add producer doctor diagnostics`.
- Earlier completed hardening includes content-addressed approval, budget/readiness enforcement,
  atomic state writes, prompt provenance/runtime templates, provider/publish tests, dependency
  audit, diagnostics synchronization, and content/asset guards.
- Active uncommitted slice: attributable script revision command, snapshots, state rollback,
  approval invalidation, evidence visibility, CLI wiring, usage smoke, and documentation.
- External edits to preserve: planner/scriptwriter duration prompt changes and example model config
  change.

## Verification Evidence

- Focused script-revision-related tests reached 12/12 green with typecheck.
- A later full gate found modularity limits in `src/cli.ts` and `scripts/usage-smoke.mjs`;
  extraction into focused files began.
- On 2026-06-19, the integrated dirty worktree passed `pnpm check` with 48/48 tests, Studio build,
  modularity, secret scan, changelog, and formatting.
- `pnpm qa:usage`, `pnpm version:plan`, and `pnpm security:dependencies` also passed; the latest
  ignored report is `.ai/qa/artifacts/usage-smoke-20260618-234309/qa-report.md`.
- The script-revision slice is mechanically green but remains uncommitted and still needs the
  independent review findings resolved before completion.

## Decisions

- `src/revisions/scriptRevision.ts` is the canonical revision owner.
- Revisions are allowed only through `SCRIPT_APPROVED`; downstream package/cost/readiness runs are
  immutable.
- Revised scripts return to `SCRIPT_GENERATED` and require review/approval again.
- Existing review evidence must remain historically inspectable without appearing active.

## Remaining Work

1. Resolve the independent review findings for transaction/journaling safety, revision input file
   boundaries, stale review visibility, evidence detail, and failure-path coverage.
2. Re-run focused tests and full gates after review-driven code changes.
3. Stage only the script-revision slice while preserving external prompt/config edits.
4. Commit only when green, then re-audit the remaining product goal.

## Blockers And Risks

- Multi-write revision flow can leave partial state without a transaction or recoverable journal.
- `--file` must not ingest arbitrary sensitive paths into run artifacts.
- Physical stale review files may be mistaken for active evidence by consumers checking existence.
- Evidence and docs may overstate the revision detail exposed.
- Direct `SCRIPT_REVIEWED` rollback and injected failure behavior need stronger tests.
