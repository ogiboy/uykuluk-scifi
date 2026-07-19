import { SafeExitError } from "../../core/errors.js";
import { appendLedgerEvent } from "../../core/ledger.js";
import type { RunRecord } from "../../core/state.js";

/** Enforces the states that allow a non-paid visual review mutation. */
export async function requireVisualReviewState(run: RunRecord, stage: string): Promise<void> {
  const allowed = [
    "PRODUCTION_PACKAGE_GENERATED",
    "PAID_GENERATION_COST_APPROVED",
    "READY_FOR_MANUAL_PRODUCTION",
  ] as const;
  if (!allowed.includes(run.state as (typeof allowed)[number])) {
    await appendLedgerEvent({
      runId: run.runId,
      type: "GUARD_BLOCKED",
      stage,
      message: `Visual review requires state ${allowed.join(" or ")}; got ${run.state}.`,
      data: { actual: run.state, expected: allowed },
    });
    throw new SafeExitError(
      `Blocked: ${stage} requires state ${allowed.join(" or ")}; current state is ${run.state}.`,
    );
  }
  await appendLedgerEvent({
    runId: run.runId,
    type: "GUARD_PASSED",
    stage,
    message: `Visual review state gate passed: ${run.state}.`,
    data: { actual: run.state, expected: allowed },
  });
}
