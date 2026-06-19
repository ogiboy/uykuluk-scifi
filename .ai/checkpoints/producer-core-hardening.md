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

- Branch/worktree: `feat/core-paid-cost-approval` at
  `/Users/ogiboy/.codex/worktrees/894d/uykuluk-scifi`.
- Base: `7bd5801`, the merge of the completed script approval/revision hardening work.
- Earlier completed hardening includes content-addressed script approval and revisions,
  budget/readiness enforcement, atomic state writes, prompt provenance/runtime templates,
  provider/publish tests, dependency audit, diagnostics synchronization, and content/asset guards.
- Completed slice: `feat(core): add paid generation cost approvals` on the current branch.
- Worktree was clean before this slice.

## Verification Evidence

- Baseline on 2026-06-19: `pnpm test` passed 48/48 and `pnpm typecheck` passed before edits.
- Three independent read-only reviews agreed that approval must bind an exact persisted quote and
  that paid execution must remain disabled until atomic reservation/settlement exists.
- Current plan: `.ai/plans/2026-06-19-paid-generation-cost-approval.md`.
- Strict TDD added 7 paid-generation cost approval tests; focused cost/readiness/mock tests and
  typecheck pass.
- `pnpm check` passed with 56/56 tests, Studio production build, modularity, secret scan, changelog,
  and formatting.
- `pnpm qa:usage`, `pnpm version:plan`, and `pnpm security:dependencies` passed; the latest ignored
  smoke report is `.ai/qa/artifacts/usage-smoke-20260619-050114/qa-report.md`.
- A diff-scoped Codex Security scan reviewed all 12 executable/test worklist rows and reported no
  surviving findings after JSON-plus-Markdown quote binding was added.

## Decisions

- `src/costs/` owns cost quote shape and fingerprints; core state/ledger owns approval authority.
- Cost approval covers future paid production stages after package generation only.
- Cost approval does not authorize or execute a provider call.
- Hard budgets remain non-overridable and must be rechecked at readiness and future execution.
- Paid execution still requires atomic reservation, one-time consumption, settlement, and
  reconciliation before any provider mode is enabled.

## Remaining Work

1. Re-audit the next product gap, with atomic cost reservation/settlement as the primary core
   hardening candidate.
2. Keep paid providers disabled until reservation, one-time consumption, settlement, uncertain
   outcome handling, and reconciliation are implemented and verified.

## Blockers And Risks

- Cost quote approval is not sufficient for paid execution; reservation/settlement remains open.
- Cost and event ledgers are not yet concurrency-safe or tamper-evident.
- Run ID path validation and broader stale-artifact readiness checks remain separate hardening work.
