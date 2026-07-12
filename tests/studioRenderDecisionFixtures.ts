import { writeFile } from "node:fs/promises";
import { artifactPath } from "../src/core/artifacts";
import { loadRun, saveRun } from "../src/core/runStore";
import { finalReviewNextSafeAction } from "../src/stages/finalReview/finalReviewBundleContent";
import {
  finalReviewBundleJsonPath,
  finalReviewBundleMarkdownPath,
  type FinalReviewBundle,
} from "../src/stages/finalReview/finalReviewBundleContracts";
import {
  renderDecisionJsonPath,
  renderDecisionMarkdownPath,
} from "../src/stages/render/renderDecisionCommands";
import type { RenderDecisionRecord } from "../src/stages/render/renderDecisionContracts";
import { renderDecisionNextSafeAction } from "../src/stages/renderDecision";

/**
 * Writes a Studio-valid render decision artifact for a rendered fixture run.
 *
 * @param runId - The run identifier.
 * @param decision - The local review outcome to persist.
 * @returns The persisted render decision record.
 */
export async function writeStudioRenderDecision(
  runId: string,
  decision: RenderDecisionRecord["decision"] = "accepted-for-local-review",
): Promise<RenderDecisionRecord> {
  const run = await loadRun(runId);
  const record: RenderDecisionRecord = {
    blockedActions: [
      "Private upload remains disabled until a separate future upload approval and configuration exist.",
      "Scheduled/public publish remains disabled and requires a separate future risk review.",
    ],
    createdAt: "2026-06-28T00:00:00.000Z",
    decision,
    draftRender: {
      durationSeconds: 8.2,
      path: "production/render/draft.mp4",
      reviewCommand: "ffmpeg -v error -i production/render/draft.mp4 -f null -",
      sha256: "a".repeat(64),
    },
    nextSafeAction: renderDecisionNextSafeAction(decision, runId),
    notes: "Reviewed locally from Studio fixture.",
    renderApproval: { approvalId: "approval_render_fixture", approvedRef: "d".repeat(64) },
    reviewedBy: "operator",
    runId,
    schemaVersion: 1,
    voiceover: { mode: "local-piper", productionVoiceCandidate: true, quality: "local-piper" },
  };
  await writeFile(artifactPath(runId, renderDecisionJsonPath), JSON.stringify(record), "utf8");
  await writeFile(
    artifactPath(runId, renderDecisionMarkdownPath),
    "# Draft Render Operator Decision\n\nReviewed locally.",
    "utf8",
  );
  await saveRun({
    ...run,
    artifacts: Array.from(
      new Set([...run.artifacts, renderDecisionJsonPath, renderDecisionMarkdownPath]),
    ),
  });
  return record;
}

/**
 * Writes a Studio-valid final review bundle for a rendered fixture run.
 *
 * @param runId - The run identifier.
 * @param decision - The local review outcome represented by the bundle.
 * @returns The persisted final review bundle.
 */
export async function writeStudioFinalReviewBundle(
  runId: string,
  decision: RenderDecisionRecord["decision"] = "accepted-for-local-review",
): Promise<FinalReviewBundle> {
  const renderDecision = await writeStudioRenderDecision(runId, decision);
  const run = await loadRun(runId);
  const bundle: FinalReviewBundle = {
    artifacts: [
      {
        label: "Draft render review",
        operatorAction: "Review locally before any future upload path.",
        path: "production/render/draft_review.md",
        reviewPhase: "draft-render",
      },
      {
        label: "Render decision",
        operatorAction: "Keep with the local final review handoff.",
        path: "production/render/render_decision.md",
        reviewPhase: "operator-decision",
      },
    ],
    blockedActions: [
      "Upload remains disabled until a future private-upload approval/config path exists.",
    ],
    createdAt: "2026-06-28T00:05:00.000Z",
    draftRender: {
      chapters: {
        jsonPath: "production/render/youtube_chapters.json",
        jsonSha256: "b".repeat(64),
        markdownPath: "production/render/youtube_chapters.md",
        markdownSha256: "c".repeat(64),
      },
      durationSeconds: 8.2,
      manifestPath: "production/render/render_manifest.json",
      media: { audioCodec: "aac", height: 720, videoCodec: "h264", width: 1280 },
      path: "production/render/draft.mp4",
      reviewCommand: "ffmpeg -v error -i production/render/draft.mp4 -f null -",
      reviewPath: "production/render/draft_review.md",
      sha256: "a".repeat(64),
    },
    nextSafeAction: finalReviewNextSafeAction(runId, {
      createdAt: renderDecision.createdAt,
      decision: renderDecision.decision,
      kind: "present",
      nextSafeAction: renderDecision.nextSafeAction,
      notes: renderDecision.notes,
      reviewCommand: `pnpm producer review render-decision --run ${runId}`,
      reviewedBy: renderDecision.reviewedBy,
    }),
    renderDecision: {
      createdAt: renderDecision.createdAt,
      decision: renderDecision.decision,
      kind: "present",
      nextSafeAction: renderDecision.nextSafeAction,
      notes: renderDecision.notes,
      reviewCommand: `pnpm producer review render-decision --run ${runId}`,
      reviewedBy: renderDecision.reviewedBy,
    },
    renderPlan: {
      assetProvenancePath: "production/asset_provenance.json",
      contactSheetPath: "production/storyboard_contact_sheet.md",
      estimatedDraftDurationSeconds: 8.2,
      path: "production/render_plan.json",
      sceneCount: 1,
    },
    runId,
    schemaVersion: 2,
    status: decision,
    summary: "Local final review handoff is ready for operator review.",
    voiceover: {
      mode: "local-piper",
      path: "production/audio/voiceover.wav",
      productionVoiceCandidate: true,
      quality: "local-piper",
      renderApprovalScope: "approval_render_fixture",
      reviewPath: "production/audio/voiceover_review.md",
    },
  };
  await writeFile(artifactPath(runId, finalReviewBundleJsonPath), JSON.stringify(bundle), "utf8");
  await writeFile(
    artifactPath(runId, finalReviewBundleMarkdownPath),
    "# Final Review Bundle\n\nUpload remains disabled.",
    "utf8",
  );
  await saveRun({
    ...run,
    artifacts: Array.from(
      new Set([...run.artifacts, finalReviewBundleJsonPath, finalReviewBundleMarkdownPath]),
    ),
  });
  return bundle;
}
