import { ApprovalRecord } from "../core/state";
import { artifactPath } from "../core/artifacts";
import { appendLedgerEvent } from "../core/ledger";
import { loadRun, setRunState } from "../core/runStore";
import { assertTransition } from "../core/transitions";
import { pathExists } from "../utils/fs";
import { createId, nowIso } from "../utils/time";
import { SafeExitError } from "../core/errors";
import { requireState } from "../safeguards/approvalGuard";

export async function approveScript(runId: string): Promise<ApprovalRecord> {
  let run = await loadRun(runId);
  await requireState(run, "SCRIPT_REVIEWED", "approve-script");
  assertTransition(run.state, "SCRIPT_APPROVED");
  if (!(await pathExists(artifactPath(run.runId, "reviews/script_review.json")))) {
    await appendLedgerEvent({
      runId: run.runId,
      type: "GUARD_BLOCKED",
      stage: "approve-script",
      message: "Script review artifact is missing.",
    });
    throw new SafeExitError("Cannot approve script before script review exists.");
  }
  const approval: ApprovalRecord = {
    approvalId: createId("approval"),
    runId: run.runId,
    target: "script",
    previousState: run.state,
    nextState: "SCRIPT_APPROVED",
    approvingCommand: "producer approve script",
    createdAt: nowIso(),
  };
  run = {
    ...run,
    approvals: [...run.approvals.filter((item) => item.target !== "script"), approval],
  };
  await appendLedgerEvent({
    runId: run.runId,
    type: "APPROVAL_RECORDED",
    stage: "approve-script",
    message: "Script approved.",
    data: approval,
  });
  await setRunState(run, "SCRIPT_APPROVED", "approve-script");
  return approval;
}
