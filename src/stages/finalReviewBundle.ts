import { writeRunJson, writeRunText } from "../core/artifacts.js";
import { SafeExitError } from "../core/errors.js";
import { loadRun, saveRun } from "../core/runStore.js";
import { nowIso } from "../utils/time.js";
import {
  finalReviewArtifacts,
  finalReviewBlockedActions,
  finalReviewMediaSummary,
  finalReviewNextSafeAction,
  finalReviewStatus,
  finalReviewSummary,
} from "./finalReview/finalReviewBundleContent.js";
import {
  finalReviewBundleJsonPath,
  finalReviewBundleMarkdownPath,
  finalReviewBundleSchema,
  type CurrentFinalReviewBundle,
} from "./finalReview/finalReviewBundleContracts.js";
import { renderFinalReviewBundleMarkdown } from "./finalReview/finalReviewBundleMarkdown.js";
import { renderDecisionCommandTemplates } from "./render/renderDecisionCommands.js";
import { readRenderDecisionStatus } from "./render/renderDecisionStatus.js";
import { reviewDraftRender } from "./reviewRender.js";
import { reviewRenderPlan } from "./reviewRenderPlan.js";
import { reviewVoiceover } from "./reviewVoiceover.js";
import { requireApprovedSoundtrackManifest } from "./soundtrack/soundtrackService.js";

export {
  finalReviewBundleJsonPath,
  finalReviewBundleMarkdownPath,
  finalReviewBundleSchema,
  type CurrentFinalReviewBundle,
} from "./finalReview/finalReviewBundleContracts.js";
export type { FinalReviewBundle } from "./finalReview/finalReviewBundleContracts.js";
export { renderFinalReviewBundleMarkdown } from "./finalReview/finalReviewBundleMarkdown.js";

/**
 * Creates the local final review handoff bundle for a rendered run.
 *
 * The bundle is a local operator index only. It revalidates the current render-plan, voiceover,
 * draft-render, and optional render-decision evidence, then writes durable JSON and Markdown
 * artifacts without changing run state or approving upload/publish.
 *
 * @param runId - The rendered run to bundle for local review.
 * @returns The persisted final review bundle.
 */
export async function createFinalReviewBundle(runId: string): Promise<CurrentFinalReviewBundle> {
  let run = await loadRun(runId);
  if (run.state !== "RENDERED") {
    throw new SafeExitError("Final review bundle requires state RENDERED.");
  }
  const renderPlan = await reviewRenderPlan(run.runId);
  const voiceover = await reviewVoiceover(run.runId);
  const draftRender = await reviewDraftRender(run.runId);
  const renderDecision = await finalReviewDecision(run);
  if (draftRender.schemaVersion !== 11) {
    throw new SafeExitError("Final review bundle v3 requires a current v11 draft render manifest.");
  }
  const soundtrack = await requireApprovedSoundtrackManifest(run);
  if (draftRender.soundtrack.manifestDigest !== soundtrack.digest) {
    throw new SafeExitError(
      "Final review bundle requires the approved soundtrack bound to the v11 render evidence.",
    );
  }
  const bundle = finalReviewBundleSchema.parse({
    schemaVersion: 3,
    runId: run.runId,
    createdAt: nowIso(),
    status: finalReviewStatus(renderDecision),
    summary: finalReviewSummary(renderDecision),
    renderPlan: {
      path: renderPlan.renderPlanPath,
      contactSheetPath: renderPlan.contactSheetPath,
      assetProvenancePath: renderPlan.assetProvenancePath,
      sceneCount: renderPlan.sceneCount,
      estimatedDraftDurationSeconds: renderPlan.estimatedDraftDurationSeconds,
    },
    media: finalReviewMediaSummary(draftRender, soundtrack.manifest),
    voiceover: {
      path: voiceover.audioPath,
      mode: voiceover.mode,
      quality: voiceover.quality,
      productionVoiceCandidate: voiceover.productionVoiceCandidate,
      reviewPath: voiceover.reviewPath,
      renderApprovalScope: voiceover.renderApprovalScope,
    },
    draftRender: {
      path: draftRender.output.path,
      reviewPath: "production/render/draft_review.md",
      manifestPath: "production/render/render_manifest.json",
      sha256: draftRender.output.sha256,
      durationSeconds: draftRender.output.durationSeconds,
      reviewCommand: draftRender.ffmpeg.reviewCommand,
      chapters: draftRender.chapterDraft,
      media: {
        audioCodec: draftRender.mediaProbe.audio.codecName,
        videoCodec: draftRender.mediaProbe.video.codecName,
        width: draftRender.mediaProbe.video.width,
        height: draftRender.mediaProbe.video.height,
      },
    },
    renderDecision,
    artifacts: finalReviewArtifacts(renderDecision),
    nextSafeAction: finalReviewNextSafeAction(run.runId, renderDecision),
    blockedActions: finalReviewBlockedActions(renderDecision),
  });
  run = await writeRunJson(run, "final-review-bundle", finalReviewBundleJsonPath, bundle);
  run = await writeRunText(
    run,
    "final-review-bundle",
    finalReviewBundleMarkdownPath,
    renderFinalReviewBundleMarkdown(bundle),
  );
  await saveRun(run);
  return bundle;
}

async function finalReviewDecision(
  run: Awaited<ReturnType<typeof loadRun>>,
): Promise<CurrentFinalReviewBundle["renderDecision"]> {
  const status = await readRenderDecisionStatus(run);
  if (status.kind === "present") {
    return {
      kind: "present",
      decision: status.decision.decision,
      reviewedBy: status.decision.reviewedBy,
      createdAt: status.decision.createdAt,
      notes: status.decision.notes,
      reviewCommand: status.reviewCommand,
      nextSafeAction: status.decision.nextSafeAction,
    };
  }
  if (status.kind === "missing" && status.nextAction) {
    return {
      kind: "missing",
      nextAction: status.nextAction,
      commandTemplates: renderDecisionCommandTemplates(run.runId),
    };
  }
  const message =
    status.kind === "missing"
      ? "Render decision is not available for this run state."
      : status.message;
  throw new SafeExitError(
    `Final review bundle requires trusted render-decision status: ${message}`,
  );
}
