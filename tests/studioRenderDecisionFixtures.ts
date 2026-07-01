import { readFile, writeFile } from "node:fs/promises";
import { artifactPath } from "../src/core/artifacts";
import { loadRun, saveRun } from "../src/core/runStore";
import { sha256 } from "../src/utils/hash";
import {
  channelHandoffJsonPath,
  channelHandoffMarkdownPath,
  type ChannelHandoff,
} from "../src/stages/channelHandoffContracts";
import {
  finalReviewBundleJsonPath,
  finalReviewBundleMarkdownPath,
  type FinalReviewBundle,
} from "../src/stages/finalReviewBundleContracts";
import { finalReviewNextSafeAction } from "../src/stages/finalReviewBundleContent";
import {
  renderDecisionJsonPath,
  renderDecisionMarkdownPath,
} from "../src/stages/renderDecisionCommands";
import type { RenderDecisionRecord } from "../src/stages/renderDecisionContracts";

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
    nextSafeAction: nextSafeAction(decision, runId),
    notes: "Reviewed locally from Studio fixture.",
    renderApproval: {
      approvalId: "approval_render_fixture",
      approvedRef: "d".repeat(64),
    },
    reviewedBy: "operator",
    runId,
    schemaVersion: 1,
    voiceover: {
      mode: "local-piper",
      productionVoiceCandidate: true,
      quality: "local-piper",
    },
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
      durationSeconds: 8.2,
      manifestPath: "production/render/render_manifest.json",
      media: {
        audioCodec: "aac",
        height: 720,
        videoCodec: "h264",
        width: 1280,
      },
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
    schemaVersion: 1,
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

/**
 * Writes a Studio-valid manual channel handoff for a rendered fixture run.
 *
 * @param runId - The run identifier.
 * @returns The persisted manual channel handoff.
 */
export async function writeStudioChannelHandoff(runId: string): Promise<ChannelHandoff> {
  await writeStudioFinalReviewBundle(runId, "accepted-for-local-review");
  const finalReviewJson = await readFixtureText(runId, finalReviewBundleJsonPath);
  const run = await loadRun(runId);
  const handoff: ChannelHandoff = {
    blockedActions: [
      "This handoff does not call YouTube APIs or create a private upload.",
      "This handoff does not approve public or scheduled publishing.",
    ],
    createdAt: "2026-06-28T00:10:00.000Z",
    finalReviewBundle: {
      digest: sha256(finalReviewJson),
      markdownPath: finalReviewBundleMarkdownPath,
      path: finalReviewBundleJsonPath,
      status: "accepted-for-local-review",
    },
    manualOnly: true,
    media: {
      draftRenderPath: "production/render/draft.mp4",
      draftRenderSha256: "a".repeat(64),
      durationSeconds: 8.2,
      renderReviewPath: "production/render/draft_review.md",
      subtitlesPath: "production/subtitles.srt",
    },
    nextSafeAction:
      "Manually review production/channel_handoff.md, the MP4, subtitles, metadata, and thumbnail assets before any future private-upload approval path is used.",
    operatorChecklist: ["Watch the draft MP4 from start to finish outside the app."],
    runId,
    schemaVersion: 1,
    status: "ready-for-manual-channel-review",
    youtube: {
      description: "Fixture description.",
      metadataPath: "production/youtube_metadata.json",
      tags: ["uykuluk", "scifi"],
      title: "Fixture title",
    },
  };
  await writeFile(artifactPath(runId, channelHandoffJsonPath), JSON.stringify(handoff), "utf8");
  await writeFile(
    artifactPath(runId, channelHandoffMarkdownPath),
    "# Manual Channel Handoff\n\nUpload remains disabled.",
    "utf8",
  );
  await saveRun({
    ...run,
    artifacts: Array.from(
      new Set([...run.artifacts, channelHandoffJsonPath, channelHandoffMarkdownPath]),
    ),
  });
  return handoff;
}

function nextSafeAction(decision: RenderDecisionRecord["decision"], runId: string): string {
  if (decision === "accepted-for-local-review") {
    return `Create the local final review handoff with pnpm producer review-bundle --run ${runId}. Upload remains disabled until a future private-upload approval/config path exists.`;
  }
  if (decision === "needs-revision") {
    return "Revise package, render plan, voiceover, subtitles, or assets; then regenerate evidence/readiness and render a new local draft.";
  }
  return "Do not use this draft. Revise upstream artifacts before any new render approval.";
}

async function readFixtureText(runId: string, relativePath: string): Promise<string> {
  return readFile(artifactPath(runId, relativePath), "utf8");
}
