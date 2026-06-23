import { appendLedgerEvent } from "../core/ledger.js";
import { ApprovalTarget, RunRecord, RunState } from "../core/state.js";
import { SafeExitError } from "../core/errors.js";

export async function requireState(
  run: RunRecord,
  expected: RunState,
  stage: string,
): Promise<void> {
  if (run.state !== expected) {
    await appendLedgerEvent({
      runId: run.runId,
      type: "GUARD_BLOCKED",
      stage,
      message: `Required state ${expected}, got ${run.state}.`,
      data: { expected, actual: run.state },
    });
    throw new SafeExitError(
      `Blocked: ${stage} requires state ${expected}; current state is ${run.state}.`,
    );
  }
  await appendLedgerEvent({
    runId: run.runId,
    type: "GUARD_PASSED",
    stage,
    message: `State gate passed: ${expected}.`,
    data: { expected },
  });
}

export async function requireApproval(
  run: RunRecord,
  target: ApprovalTarget,
  stage: string,
): Promise<void> {
  const approval = run.approvals.find((item) => item.runId === run.runId && item.target === target);
  if (!approval) {
    await appendLedgerEvent({
      runId: run.runId,
      type: "GUARD_BLOCKED",
      stage,
      message: `Missing explicit ${target} approval.`,
      data: { target },
    });
    throw new SafeExitError(`Blocked: ${stage} requires explicit ${target} approval.`);
  }
  await appendLedgerEvent({
    runId: run.runId,
    type: "GUARD_PASSED",
    stage,
    message: `Approval gate passed: ${target}.`,
    data: { approvalId: approval.approvalId, target },
  });
}
