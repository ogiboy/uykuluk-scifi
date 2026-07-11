import { readFile } from "node:fs/promises";
import { artifactPath } from "../core/artifacts.js";
import { SafeExitError } from "../core/errors.js";
import { appendLedgerEvent } from "../core/ledger.js";
import { loadRun, setRunState } from "../core/runStore.js";
import { ApprovalRecord } from "../core/state.js";
import { assertTransition } from "../core/transitions.js";
import { requireState } from "../safeguards/approvalGuard.js";
import { pathExists } from "../utils/fs.js";
import { sha256 } from "../utils/hash.js";
import { createId, nowIso } from "../utils/time.js";

/**
 * Approves a script for a given run after verifying its content matches the previously reviewed state.
 *
 * @param runId - The ID of the run containing the script to approve
 * @returns The approval record for the script
 */
export async function approveScript(
  runId: string,
  options: { acknowledgeWarnings?: boolean } = {},
): Promise<ApprovalRecord> {
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
  const script = await readFile(artifactPath(run.runId, "script.md"), "utf8");
  const review = JSON.parse(
    await readFile(artifactPath(run.runId, "reviews/script_review.json"), "utf8"),
  ) as {
    scriptHash?: string;
    blockerCount?: number;
    warningCount?: number;
    warnings?: Array<{ code?: string; severity?: string }>;
  };
  const scriptHash = sha256(script);
  if (!review.scriptHash || review.scriptHash !== scriptHash) {
    await appendLedgerEvent({
      runId: run.runId,
      type: "GUARD_BLOCKED",
      stage: "approve-script",
      message: "Script content hash does not match the reviewed artifact.",
      data: { reviewedHash: review.scriptHash ?? null, currentHash: scriptHash },
    });
    throw new SafeExitError("Cannot approve script because it changed after review.");
  }
  const blockerCount =
    review.blockerCount ??
    review.warnings?.filter((warning) => warning.severity === "blocker").length ??
    0;
  if (blockerCount > 0) {
    await appendLedgerEvent({
      runId: run.runId,
      type: "GUARD_BLOCKED",
      stage: "approve-script",
      message: "Script review has blocking findings.",
      data: { blockerCount },
    });
    throw new SafeExitError("Cannot approve script with blocking review findings.");
  }
  const warningCodes = reviewWarningCodes(review.warnings);
  const nonBlockingWarningCount =
    (review.warningCount ?? review.warnings?.length ?? 0) - blockerCount;
  if (nonBlockingWarningCount > 0 && !options.acknowledgeWarnings) {
    await appendLedgerEvent({
      runId: run.runId,
      type: "GUARD_BLOCKED",
      stage: "approve-script",
      message: "Script review warnings require explicit acknowledgement.",
      data: { warningCount: nonBlockingWarningCount, warningCodes },
    });
    throw new SafeExitError(
      "Cannot approve script with review warnings unless --acknowledge-warnings is passed.",
    );
  }
  const approval: ApprovalRecord = {
    approvalId: createId("approval"),
    runId: run.runId,
    target: "script",
    approvedRef: scriptHash,
    previousState: run.state,
    nextState: "SCRIPT_APPROVED",
    approvingCommand: `producer approve script${options.acknowledgeWarnings ? " --acknowledge-warnings" : ""}`,
    ...(nonBlockingWarningCount > 0 ? { acknowledgedWarnings: warningCodes } : {}),
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

function reviewWarningCodes(warnings: Array<{ code?: string; severity?: string }> = []): string[] {
  return warnings
    .filter((warning) => warning.severity !== "blocker")
    .map((warning, index) => warning.code ?? `warning_${index + 1}`);
}
