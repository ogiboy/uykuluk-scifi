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

- Branch/worktree: `fix/core-artifact-path-validation` at
  `/Users/ogiboy/.codex/worktrees/894d/uykuluk-scifi`.
- Base: `7bd5801`, the merge of the completed script approval/revision hardening work.
- Earlier completed hardening includes content-addressed script approval and revisions,
  budget/readiness enforcement, atomic state writes, prompt provenance/runtime templates,
  provider/publish tests, dependency audit, diagnostics synchronization, and content/asset guards.
- Completed slice: `30986f8 feat(core): add paid generation cost approvals`.
- Completed slice: `e155b02 feat(core): add atomic cost reservations`.
- Completed slice: `f16e643 fix(core): validate run identifiers`.
- Completed slice: `3c04cdd fix(core): constrain artifact paths`.
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
- Current plan: `.ai/plans/2026-06-19-cost-reservation-lifecycle.md`.
- Focused reservation, recovery, budget, approval, and mock tests pass (25/25); typecheck and the
  156-file modularity gate pass.
- The reservation diff security review closed all 14 worklist rows, reproduced and fixed a
  live-owner stale-lock race, and produced validated Markdown/HTML reports with no surviving
  reportable findings.
- Final gates pass: `pnpm check` with 69/69 tests and Studio production build, `pnpm qa:usage`,
  `pnpm version:plan`, `pnpm security:dependencies`, `pnpm release:check`, and `git diff --check`.
- Latest ignored usage report: `.ai/qa/artifacts/usage-smoke-20260619-053319/qa-report.md`.
- Current plan: `.ai/plans/2026-06-19-run-id-path-validation.md`.
- Strict TDD captured 15 initial failures for malformed IDs and state-directory mismatch, then
  broadened to unrelated run-directory enumeration and CLI coverage.
- Final gates pass: `pnpm check` with 89/89 tests and Studio production build, `pnpm qa:usage`,
  `pnpm version:plan`, `pnpm security:dependencies`, `pnpm release:check`, and `git diff --check`.
- Latest ignored usage report: `.ai/qa/artifacts/usage-smoke-20260619-114340/qa-report.md`.
- Diff-scoped security review closed all 9 executable/test/supporting rows with validated
  Markdown/HTML reports and no surviving reportable findings.
- Current plan: `.ai/plans/2026-06-19-artifact-path-validation.md`.
- Strict TDD captured 20 initial failures for lexical paths, outside-write side effects, and
  persisted-state tampering; security review added 6 failing portable-name regressions.
- Final gates pass: `pnpm check` with 121/121 tests and Studio production build, `pnpm qa:usage`,
  `pnpm version:plan`, `pnpm security:dependencies`, `pnpm release:check`, modularity, secret scan,
  changelog, formatting, and security report validation.
- Latest ignored usage report: `.ai/qa/artifacts/usage-smoke-20260619-115623/qa-report.md`.
- Diff-scoped security review closed all 6 executable/test/supporting rows, reproduced and fixed
  Windows reserved-device/trailing-dot aliases, and produced validated Markdown/HTML reports with no
  surviving reportable findings.

## Decisions

- `src/costs/` owns cost quote shape and fingerprints; core state/ledger owns approval authority.
- Cost approval covers future paid production stages after package generation only.
- Cost approval does not authorize or execute a provider call.
- Hard budgets remain non-overridable and must be rechecked at readiness and future execution.
- Paid execution remains disabled until the first adapter uses reservation as its only provider-call
  path and proves failure/timeout behavior.

## Remaining Work

1. Re-audit symlink containment and stale-artifact readiness as the next safe-core candidates.
2. Choose the smallest enforceable vertical slice and continue under strict TDD.

## Blockers And Risks

- Cost quote approval and reservation infrastructure are not sufficient to enable a paid provider;
  adapter integration and end-to-end failure semantics remain open.
- Reservation writes are serialized locally, but JSONL ledgers are not cryptographically
  tamper-evident and the lock is not a distributed lease.
- Symlink containment and stale-artifact readiness checks remain separate hardening work.
