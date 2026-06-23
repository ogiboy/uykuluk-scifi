import { SafeExitError } from "../core/errors.js";
import { appendLedgerEvent } from "../core/ledger.js";
import { loadRun, setRunState } from "../core/runStore.js";
import { ApprovalRecord } from "../core/state.js";
import { assertTransition } from "../core/transitions.js";
import { requireState } from "../safeguards/approvalGuard.js";
import { createId, nowIso } from "../utils/time.js";
import { verifyProductionPackage } from "./productionPackageIntegrity.js";
import { renderApprovalRef } from "./renderApproval.js";
import { readRenderPlanEvidence } from "./renderPlan.js";
import { readVoiceoverAudioEvidence } from "./voiceoverEvidence.js";

export async function approveRender(runId: string): Promise<ApprovalRecord> {
  let run = await loadRun(runId);
  await requireState(run, "READY_FOR_MANUAL_PRODUCTION", "approve-render");
  assertTransition(run.state, "RENDER_APPROVED");
  try {
    await verifyProductionPackage(run);
    const renderPlan = await readRenderPlanEvidence(run);
    if (renderPlan.status !== "pass") {
      throw new SafeExitError("Cannot approve render without valid render-plan evidence.");
    }
    const voiceoverAudio = await readVoiceoverAudioEvidence(run);
    if (voiceoverAudio.status !== "pass") {
      throw new SafeExitError("Cannot approve render without valid voiceover audio evidence.");
    }
    const approval: ApprovalRecord = {
      approvalId: createId("approval"),
      runId: run.runId,
      target: "render",
      approvedRef: renderApprovalRef({
        renderPlanDigest: renderPlan.digest,
        voiceoverAudioDigest: voiceoverAudio.digest,
      }),
      previousState: run.state,
      nextState: "RENDER_APPROVED",
      approvingCommand: "producer approve render",
      createdAt: nowIso(),
    };
    run = {
      ...run,
      approvals: [...run.approvals.filter((item) => item.target !== "render"), approval],
    };
    await appendLedgerEvent({
      runId: run.runId,
      type: "APPROVAL_RECORDED",
      stage: "approve-render",
      message: "Render approved for the current render plan and voiceover audio.",
      data: approval,
    });
    await setRunState(run, "RENDER_APPROVED", "approve-render");
    return approval;
  } catch (error) {
    await appendLedgerEvent({
      runId: run.runId,
      type: "GUARD_BLOCKED",
      stage: "approve-render",
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
