# Reserved Provider Execution Contract

## Goal

Add one internal, adapter-bound execution boundary for future nonzero-cost provider calls so the
callback cannot run before exact quote approval, live budget validation, reservation, and a durable
execution claim. Do not enable a paid provider, CLI command, TTS, render, upload, or publish path.

## Contract

- `src/costs/reservedProviderExecution.ts` is the only orchestration owner for future paid callback
  execution.
- The adapter declares its provider and model identity; reservation rejects a mismatch with the
  approved quote before callback invocation.
- `EXECUTION_STARTED` is persisted under the project reservation lock immediately before invoking
  the callback.
- Only `RESERVED -> EXECUTION_STARTED` owns permission to invoke the callback.
- The callback receives the reservation ID, operation ID/idempotency key, quoted provider/model,
  approved maximum USD micros, and an `AbortSignal`.
- Callback outcomes are typed as `success`, `definitely-not-sent`, or `unknown`.
- Success settles the exact actual USD micros and usage metadata.
- Definitely-not-sent releases the reservation; the quote line remains consumed.
- Unknown outcomes, unexpected callback exceptions, invalid success receipts, and timeouts become
  `UNCERTAIN`.
- Same-operation retries in `EXECUTION_STARTED`, `SETTLEMENT_PENDING`, `UNCERTAIN`, `RELEASED`, or
  `SETTLED` never invoke the callback again.
- Concurrent executions for one operation or quote line invoke at most one callback.
- Reservation events remain the durable source of truth; evidence bundles project the latest
  execution state when regenerated.
- Raw provider request ids are bounded at callback validation and only SHA-256 hashes persist.

## TDD Route

- Mode: strict.
- RED coverage: blocked preconditions, adapter mismatch, durable call ordering, exact settlement,
  definitely-not-sent release, explicit unknown, exception sanitization, timeout/abort, malformed
  success metadata, same-operation retry, and concurrent dispatch.
- GREEN verification: focused execution/reservation/recovery/evidence tests, then full project
  gates, clean-copy usage smoke, release/dependency checks, and diff-scoped security review.

## Compatibility Boundary

- Existing mock and Ollama LLM generation remains unchanged and zero-cost.
- No provider registry, paid SDK, credential, or network adapter is added.
- No CLI command exposes reserve, execute, settle, release, uncertain, or reconcile mutations.
- Main run state does not gain provider-execution states; reservation state owns this lifecycle.
- Public/scheduled publishing remains disabled by default.

## Tasks

1. Add RED tests for the composed execution boundary.
2. Add `EXECUTION_STARTED` reservation persistence and atomic claim behavior.
3. Implement adapter identity validation, typed outcomes, bounded timeout/abort, and fail-closed
   orchestration.
4. Project execution evidence and update cost-control/product contracts.
5. Run full quality, usage, release, dependency, and security gates.
6. Commit and push only when green.
