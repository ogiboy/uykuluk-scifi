# Paid Generation Cost Approval

## Goal

Add a durable, content-addressed approval contract for an exact future paid-generation cost quote
without enabling paid providers or treating approval as permission to spend.

## Architecture

- `src/costs/` owns the quote schema, quote construction, relevant config/pricing fingerprints, and
  exact persisted quote digest.
- `src/core/` owns the new approval target and resumable workflow state.
- `src/stages/approveCost.ts` owns operator approval of one persisted quote.
- readiness recomputes current constraints and validates the quote/approval pair.
- no provider call consumes this approval in this slice; atomic reservation, consumption,
  settlement, retry, and reconciliation remain mandatory before paid execution is enabled.

## Tech Stack

TypeScript, Zod, Commander, Vitest, local JSON artifacts, append-only JSONL ledger.

## Baseline / Authority Refs

- `AGENTS.md`
- `.ai/architecture.instructions.md`
- `.ai/current-state.instructions.md`
- `.ai/tasks.instructions.md`
- `.ai/workflows/feature-workflow.instructions.md`
- `.ai/workflows/security-workflow.instructions.md`
- `ROADMAP.md`

## Compatibility Boundary

- Mock and Ollama workflows remain zero-cost and require no cost approval.
- TTS, image/video generation, render, upload, and publish remain disabled.
- Hard per-video, daily, and weekly budgets are never overridable by approval.
- Existing zero-cost runs remain readable and can reach readiness.
- Legacy or malformed nonzero estimates fail closed and must be regenerated.

## Verification

```bash
pnpm test tests/costApproval.test.ts tests/budgetGuard.test.ts tests/readiness.test.ts
pnpm check
pnpm qa:usage
pnpm version:plan
pnpm security:dependencies
```

## Plan Basis

- Fact: current threshold detection has no durable cost approval target.
- Fact: readiness trusts editable `nextStepAllowed` and `blockedReasons` fields.
- Fact: no current provider can spend money.
- Assumption: the current post-package estimate should cover future paid production stages only.
- Unknown intentionally left outside this slice: paid-provider reservation and settlement design.

## Architecture Integrity Lens

- Invariant: no nonzero provider call may occur without an exact approval and live hard-budget pass.
- Canonical owner: quote data under `src/costs/`; authorization in core approval state and ledger.
- Responsibility overlap: budget calculation must not become an approval store.
- Higher-level path: one typed quote consumed by CLI, readiness, evidence, and future reservation.
- Retirement / falsifier: retire readiness trust in loose estimate booleans; paid execution remains
  prohibited until reservation/settlement exists.
- Verdict: proceed with quote approval only.

## Complexity Budget

- Artifact class: persisted core contract spanning state, costs, stage, readiness, CLI, tests, docs.
- Current pressure: `src/cli.ts` is near the modularity limit.
- Projected pressure: within budget if approval commands are extracted and quote logic gets a
  dedicated owner.
- Planned governance: add `src/cli/approvalCommands.ts` and `src/costs/costEstimate.ts`.

## Tasks

### 1. Define the typed quote and approval contract

Files:

- Create `src/costs/costEstimate.ts`.
- Modify `src/core/state.ts` and `src/core/transitions.ts`.
- Add `tests/costApproval.test.ts`.

Steps:

1. Write failing tests for the new state, target, quote validation, and exact quote digest.
2. Run the focused test and confirm RED.
3. Add the minimal schemas/helpers and transition.
4. Run the focused test and confirm GREEN.

### 2. Generate and approve an exact quote

Files:

- Modify `src/stages/estimate.ts`.
- Create `src/stages/approveCost.ts`.
- Create `src/cli/approvalCommands.ts`.
- Modify `src/cli.ts`.
- Extend `tests/costApproval.test.ts`.

Steps:

1. Write failing tests for required, unnecessary, hard-blocked, and tampered quote approval.
2. Run the focused test and confirm RED.
3. Persist a versioned quote without recording incurred cost; record exact approval and state.
4. Register `producer approve cost --run <run_id>` without provider execution.
5. Run focused tests and confirm GREEN.

### 3. Revalidate readiness and evidence

Files:

- Modify `src/stages/readiness.ts`.
- Modify `src/stages/evidence.ts`.
- Modify `tests/readiness.test.ts` and `tests/mockPipeline.test.ts`.
- Modify usage smoke flow when operator behavior changes.

Steps:

1. Write failing tests for missing, stale, cross-run, and live-budget-invalid approvals.
2. Run focused tests and confirm RED.
3. Recompute quote validity and hard budgets during readiness.
4. Expose quote digest, approval status, and next command in evidence.
5. Run focused tests and confirm GREEN.

### 4. Align durable product documentation and verify

Files:

- Modify `.ai/current-state.instructions.md`, `.ai/tasks.instructions.md`,
  `.ai/checkpoints/producer-core-hardening.md`, `.ai/decisions.instructions.md`, `ROADMAP.md`,
  `README.md`, `CHANGELOG.md`, and relevant runbooks/checklists.

Steps:

1. Document that quote approval is not spend authorization.
2. Record atomic reservation/consumption/settlement as the remaining paid-provider prerequisite.
3. Run all required quality, usage, version, and dependency gates.
4. Review the final diff for approval bypass, mutable evidence trust, and accidental provider
   enablement.
5. Commit only if every required gate is green.

## Risks

- Quote/config drift could make approval stale; current fingerprints must be rechecked.
- Loose JSON parsing could allow tampering; all new quote reads must use the strict schema.
- A cost approval could be mistaken for reusable spend authorization; docs and types must state the
  boundary explicitly.
- Concurrent paid execution is unsafe without reservations; paid provider modes remain unavailable.

## Retirement

- Retire `nextStepAllowed` as readiness authority for new quote schema versions.
- Keep legacy zero-cost estimate compatibility only.
- Do not add a compatibility path for legacy nonzero estimates.
