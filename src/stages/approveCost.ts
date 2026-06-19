import { loadConfig } from "../config/config";
import { readCostEstimate, validateCurrentCostEstimate } from "../costs/costEstimate";
import { SafeExitError } from "../core/errors";
import { appendLedgerEvent } from "../core/ledger";
import { loadRun, setRunState } from "../core/runStore";
import { ApprovalRecord } from "../core/state";
import { assertTransition } from "../core/transitions";
import { requireState } from "../safeguards/approvalGuard";
import { createId, nowIso } from "../utils/time";

export async function approvePaidGenerationCost(runId: string): Promise<ApprovalRecord> {
  const config = await loadConfig();
  let run = await loadRun(runId);
  await requireState(run, "COST_ESTIMATED", "approve-cost");
  assertTransition(run.state, "PAID_GENERATION_COST_APPROVED");
  try {
    const { estimate, digest } = await readCostEstimate(run.runId);
    const validationReasons = await validateCurrentCostEstimate(run, config, estimate);
    if (validationReasons.length > 0) {
      throw new SafeExitError(
        `Blocked: cost estimate is stale or invalid. ${validationReasons.join(" ")}`,
      );
    }
    if (!estimate.budgetAllowed || estimate.hardBlockedReasons.length > 0) {
      throw new SafeExitError(
        `Blocked: cost approval cannot override a hard budget. ${estimate.hardBlockedReasons.join(" ")}`,
      );
    }
    if (!estimate.approvalRequired) {
      throw new SafeExitError("Blocked: this cost estimate does not require explicit approval.");
    }
    const approval: ApprovalRecord = {
      approvalId: createId("approval"),
      runId: run.runId,
      target: "paid-generation-cost",
      approvedRef: digest,
      previousState: run.state,
      nextState: "PAID_GENERATION_COST_APPROVED",
      approvingCommand: "producer approve cost",
      createdAt: nowIso(),
    };
    run = {
      ...run,
      approvals: [
        ...run.approvals.filter((item) => item.target !== "paid-generation-cost"),
        approval,
      ],
    };
    await appendLedgerEvent({
      runId: run.runId,
      type: "APPROVAL_RECORDED",
      stage: "approve-cost",
      message: "Future paid-generation cost quote approved.",
      data: approval,
    });
    await setRunState(run, "PAID_GENERATION_COST_APPROVED", "approve-cost");
    return approval;
  } catch (error) {
    await appendLedgerEvent({
      runId: run.runId,
      type: "GUARD_BLOCKED",
      stage: "approve-cost",
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
