# Cost Reservation Lifecycle

## Goal

Add an atomic, idempotent, recoverable cost reservation lifecycle that consumes each approved future
paid-production quote line at most once and accounts for active reservations in hard budgets,
without enabling any paid provider.

## Architecture

- `src/costs/costReservationLock.ts` owns one project-wide filesystem lock so reservations across
  different runs cannot race daily or weekly budgets. Stale reclamation refuses to replace a lock
  while its recorded local owner process is alive.
- `src/costs/costReservationStore.ts` owns strict reservation-event schemas, append-only
  persistence, state reconstruction, and active-reservation totals.
- `src/costs/costReservationService.ts` owns reserve, release, uncertain, settle, and reconcile
  operations. It infers provider/model/maximum amount from the approved quote instead of accepting
  caller-supplied spend parameters.
- `src/safeguards/budgetGuard.ts` includes active `RESERVED`, `SETTLEMENT_PENDING`, and `UNCERTAIN`
  amounts in per-video, daily, and weekly limits.
- `src/costs/costLedger.ts` strictly validates cost events and links settled costs to reservation
  ids for idempotent crash recovery.
- evidence reports reservation summaries; no CLI mutation command and no provider adapter are added.

## Tech Stack

TypeScript, Zod, atomic filesystem directory locks, append-only JSONL events, Vitest.

## Baseline / Authority Refs

- `AGENTS.md`
- `.ai/architecture.instructions.md`
- `.ai/current-state.instructions.md`
- `.ai/tasks.instructions.md`
- `.ai/decisions.instructions.md`
- `.ai/security/threat-model.instructions.md`
- `.ai/workflows/feature-workflow.instructions.md`
- `.ai/workflows/security-workflow.instructions.md`
- `.ai/plans/2026-06-19-paid-generation-cost-approval.md`

## Compatibility Boundary

- Mock and Ollama generation behavior remains unchanged.
- Existing cost-ledger rows remain readable through an additive optional `reservationId`.
- Paid providers, TTS, render, upload, and publish remain disabled.
- Reservation is allowed only after exact quote approval and successful readiness.
- One approved quote line can create one reservation. A released or failed attempt requires a new
  quote and approval; it is not silently reusable.
- Active or uncertain reservations reduce available hard budgets until settled or explicitly
  reconciled.

## Verification

```bash
pnpm test tests/costReservation.test.ts tests/budgetGuard.test.ts tests/costApproval.test.ts
pnpm typecheck
pnpm check
pnpm qa:usage
pnpm version:plan
pnpm security:dependencies
```

## Plan Basis

- Fact: exact quote approval exists but is not consumed by an execution contract.
- Fact: current budget checks read incurred cost events only, so concurrent future paid calls could
  both pass.
- Fact: separate state and cost-ledger writes require a recoverable settlement journal.
- Assumption: a quote approval covers each enabled quoted stage exactly once.
- Non-goal: implementing or simulating a paid provider call.

## Baseline Usage

- Required and acknowledged: repository agent contract, architecture, current state, tasks,
  decisions, threat model, feature/security workflows, prior cost-approval plan.
- Missing refs: none.
- Decision: continue.

## Architecture Integrity Lens

- Invariant: no future nonzero provider call can start without one active reservation bound to the
  exact run, quote approval, stage, provider/model, operation id, and maximum integer USD micros.
- Canonical owners: reservation store owns persistence; reservation service owns transitions; budget
  guard owns limit evaluation; provider adapters will consume the service later.
- Responsibility overlap: approvals do not track execution state, and cost events do not represent
  unspent reservations.
- Higher-level simplification: one project-wide lock protects all run/day/week decisions instead of
  adding per-stage caller locks.
- Retirement/falsifier: direct future paid calls that invoke `checkBudget` without reservation must
  be prohibited when a paid adapter is introduced.
- Verdict: proceed.

## Complexity Budget

- Artifact class: persisted security-sensitive lifecycle and shared budget contract.
- Current pressure: `costEstimate.ts`, `readiness.ts`, and `evidence.ts` are near but below module
  limits.
- Projected pressure: at risk if reservation logic is added to existing files.
- Planned governance: add dedicated lock, store, and service modules; keep evidence changes small.

## Tasks

### 1. Define strict reservation and cost-event persistence

Files:

- Create `src/costs/costReservationStore.ts`.
- Create `src/costs/money.ts`.
- Modify `src/core/state.ts`.
- Modify `src/costs/costLedger.ts`.
- Create `tests/costReservation.test.ts`.

Steps:

1. Write failing tests for strict event parsing, integer micros conversion, active summary states,
   and malformed ledger rejection.
2. Run focused tests and confirm RED.
3. Add minimal schemas, event reconstruction, and additive reservation linkage on cost events.
4. Run focused tests and confirm GREEN.

### 2. Add the project-wide lock and atomic reservation

Files:

- Create `src/costs/costReservationLock.ts`.
- Create `src/costs/costReservationService.ts`.
- Modify `src/safeguards/budgetGuard.ts`.
- Extend `tests/costReservation.test.ts` and `tests/budgetGuard.test.ts`.

Steps:

1. Write failing tests proving two concurrent operations cannot consume the same approved quote line
   and two runs cannot overbook a shared daily budget.
2. Write a failing stale-lock recovery test.
3. Run focused tests and confirm RED.
4. Implement atomic lock acquisition/reclamation, exact quote-line inference, idempotent operation
   ids, one-time line consumption, and active-reservation budget accounting.
5. Run focused tests and confirm GREEN.

### 3. Add settlement, uncertainty, and reconciliation

Files:

- Modify `src/costs/costReservationStore.ts`.
- Modify `src/costs/costReservationService.ts`.
- Extend `tests/costReservation.test.ts`.

Steps:

1. Write failing tests for release, uncertain outcome, over-cap settlement, idempotent settlement,
   and crash recovery from `SETTLEMENT_PENDING`.
2. Run focused tests and confirm RED.
3. Implement recoverable `SETTLEMENT_PENDING -> cost event -> SETTLED`, uncertain state, and
   explicit reconciliation to settled or released.
4. Run focused tests and confirm GREEN.

### 4. Expose evidence and align product contracts

Files:

- Modify `src/stages/evidence.ts`.
- Modify `tests/mockPipeline.test.ts` and `scripts/usage-smoke.mjs` only if observable output
  changes.
- Update `.ai/current-state.instructions.md`, `.ai/tasks.instructions.md`,
  `.ai/checkpoints/producer-core-hardening.md`, `.ai/decisions.instructions.md`,
  `.ai/runbooks/cost-controls.md`, `.ai/checklists/evidence-bundle.md`, `README.md`, `ROADMAP.md`,
  and `CHANGELOG.md`.

Steps:

1. Add reservation summaries to evidence without exposing lock metadata or local secrets.
2. Document that paid adapters remain disabled and must call the reservation service immediately
   before a provider request.
3. Run focused, full, usage, version, dependency, and security gates.
4. Commit only when every gate is green.

## Repair Track

- Root cause: incurred-cost-only budget accounting cannot prevent concurrent overbooking and quote
  approval has no one-time execution state.
- Canonical repair: globally locked append-only reservation lifecycle with exact quote-line binding.
- Compatibility: existing zero-cost flows and historical cost events remain valid.
- Verification: deterministic concurrent calls, hard-budget checks, idempotency, lifecycle, and
  crash-recovery tests.

## Retirement Track

- Old path: future paid adapters calling `checkBudget` and appending a cost event directly.
- Active status: no paid adapter exists yet.
- Retirement trigger: when the first paid adapter is added, its only allowed pre-call path must be
  `reserveApprovedCost`; direct budget-only execution must have a negative test.

## Risks

- Stale filesystem locks can block operation; reclamation must be bounded and race-safe.
- Multi-file settlement can partially complete; pending events plus reservation-linked cost rows
  must make retries idempotent.
- Floating point amounts can drift; reservation caps and actuals use integer USD micros.
- Releasing a reservation could accidentally permit replay; consumed quote lines remain consumed.
- Reservation evidence could be mistaken for provider execution; states and docs must distinguish
  reserved, uncertain, settled, and released.
