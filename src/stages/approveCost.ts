import { loadConfig } from "../config/config.js";
import { SafeExitError } from "../core/errors.js";
import { appendLedgerEvent } from "../core/ledger.js";
import { loadRun, setRunState } from "../core/runStore.js";
import { ApprovalRecord } from "../core/state.js";
import { assertTransition } from "../core/transitions.js";
import { readCostEstimate, validateCurrentCostEstimate } from "../costs/costEstimate.js";
import { requireState } from "../safeguards/approvalGuard.js";
import { createId, nowIso } from "../utils/time.js";

/**
 * Records explicit approval for a valid paid-generation cost estimate and advances the run to the approved state.
 *
 * The approval references the validated estimate digest and is persisted with a ledger record. Approval fails when
 * the estimate is stale, invalid, hard-blocked by budget constraints, or does not require explicit approval; failures
 * are recorded as blocked guard outcomes before being rethrown.
 *
 * @param runId - The ID of the run to approve
 * @returns The newly created approval record
 * @throws If the run is not in `COST_ESTIMATED` state, the estimate fails validation, or approval is unavailable
 */
export async function approvePaidGenerationCost(runId: string): Promise<ApprovalRecord> {
  const config = await loadConfig();
  let run = await loadRun(runId);
  await requireState(run, "COST_ESTIMATED", "approve-cost");
  assertTransition(run.state, "PAID_GENERATION_COST_APPROVED");
  try {
    const { estimate, digest } = await readCostEstimate(run.runId);
    const validationReasons = await validateCurrentCostEstimate(run, config, estimate, digest);
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
    run = { ...run, approvals: [...run.approvals, approval] };
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
