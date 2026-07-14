import { SafeExitError } from "../core/errors.js";
import { appendLedgerEvent } from "../core/ledger.js";
import { loadRun, setRunState } from "../core/runStore.js";
import { ApprovalRecord } from "../core/state.js";
import { assertTransition } from "../core/transitions.js";
import { requireState } from "../safeguards/approvalGuard.js";
import { createId, nowIso } from "../utils/time.js";
import { verifyProductionPackage } from "./production/productionPackageIntegrity.js";
import { renderApprovalRef } from "./render/renderApproval.js";
import { readRenderPlanEvidence } from "./renderPlan.js";
import { readVoiceoverAudioEvidence } from "./voice/voiceoverEvidence.js";

/**
 * Approves render for a run after required production evidence is verified.
 *
 * Replaces any existing approval for the `render` target on the run, records the approval, and advances the run to `RENDER_APPROVED`.
 *
 * @param runId - The run identifier
 * @returns The recorded render approval
 */
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
    if (!renderPlan.visualManifestDigest) {
      throw new SafeExitError(
        "Cannot approve render without visual-manifest-bound render-plan evidence.",
      );
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
        visualManifestDigest: renderPlan.visualManifestDigest,
        subtitleDigest: voiceoverAudio.subtitle.sha256,
        subtitleMetadataDigest: voiceoverAudio.subtitle.metadataSha256,
        subtitleTimingMode: voiceoverAudio.subtitle.timingMode,
        voiceMetadataDigest: voiceoverAudio.metadataDigest,
        voiceoverAudioDigest: voiceoverAudio.digest,
        voiceoverMode: voiceoverAudio.mode,
        voiceoverProductionVoiceCandidate: voiceoverAudio.productionVoiceCandidate,
        voiceoverQuality: voiceoverAudio.quality,
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
      message: "Render approved for the current visual manifest, render plan, and voiceover audio.",
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
