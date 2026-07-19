import { studioEvidenceFixture } from "./studioRunFixtures";

/**
 * Builds evidence for a production run that is ready for manual production review.
 *
 * @param runId - The production run identifier
 * @returns Evidence describing the manual production status and blocked actions
 */
export function manualProductionEvidence(
  runId: string,
  artifacts: readonly string[],
): Record<string, unknown> {
  return studioEvidenceFixture(
    runId,
    "READY_FOR_MANUAL_PRODUCTION",
    {
      nextRecommendedCommand:
        "Manual production review. Enable a TTS provider before draft render.",
      blockedActions: [
        "Render plan not generated; run pnpm producer render-plan --run <run_id> before TTS/render work.",
        "TTS disabled until configured and approved.",
      ],
      renderPlan: passRenderPlanEvidence(),
    },
    artifacts,
  );
}

export function blockedRenderedEvidence(
  runId: string,
  artifacts: readonly string[],
): Record<string, unknown> {
  return studioEvidenceFixture(
    runId,
    "RENDERED",
    {
      draftRender: {
        status: "block",
        path: "production/render/draft.mp4",
        message: "Draft render output does not match manifest.",
      },
      nextRecommendedCommand:
        "Regenerate evidence with pnpm producer evidence --run <run_id>; if draft artifacts remain blocked, revise upstream artifacts before a new render approval.",
      renderPlan: passRenderPlanEvidence(),
      voiceoverAudio: passVoiceoverEvidence(runId),
    },
    artifacts,
  );
}

export function passingRenderedEvidence(
  runId: string,
  artifacts: readonly string[],
): Record<string, unknown> {
  return studioEvidenceFixture(
    runId,
    "RENDERED",
    {
      blockedActions: [],
      draftRender: {
        status: "pass",
        path: "production/render/draft.mp4",
        digest: "c".repeat(64),
        bytes: 1024,
        durationSeconds: 8.2,
        mediaProbe: {
          binary: "ffprobe",
          durationSeconds: 8.2,
          audio: { codecName: "aac" },
          video: { height: 720, width: 1280 },
        },
        overlayRoles: ["watermark"],
        reviewPath: "production/render/draft_review.md",
        reviewChecklist: ["Review local draft only."],
        ffmpegReviewCommand: "ffmpeg -v error -i production/render/draft.mp4 -f null -",
        renderApproval: {
          approvalId: "approval_render_status",
          approvedRef: "d".repeat(64),
          contractVersion: 4,
        },
        sourceFrameCount: 4,
        sourceFrameSegments: ["intro:2", "outro:2"],
        sourceFrameCadence: [
          "intro#1=1s assets/intro/frames/intro_frame_00.jpg",
          "intro#2=1s assets/intro/frames/intro_frame_01.jpg",
          "outro#1=1.5s assets/outro/frames/outro_frame_00.jpg",
          "outro#2=1.5s assets/outro/frames/outro_frame_01.jpg",
        ],
        timelineSegments: ["intro", "scene", "outro"],
        voiceoverMode: "local-piper",
        voiceoverProductionVoiceCandidate: true,
        voiceoverQuality: "local-piper",
      },
      nextRecommendedCommand: "pnpm producer review render --run <run_id>",
      renderPlan: passRenderPlanEvidence(),
      voiceoverAudio: passVoiceoverEvidence(runId),
    },
    artifacts,
  );
}

function passRenderPlanEvidence(): Record<string, unknown> {
  return {
    status: "pass",
    path: "production/render_plan.json",
    digest: "a".repeat(64),
    artifactCount: 3,
    assetCount: 11,
  };
}

function passVoiceoverEvidence(runId: string): Record<string, unknown> {
  return {
    status: "pass",
    path: "production/audio/voiceover.wav",
    digest: "b".repeat(64),
    durationSeconds: 8.2,
    localPlaybackPath: `runs/${runId}/production/audio/voiceover.wav`,
    mode: "local-piper",
    productionVoiceCandidate: true,
    quality: "local-piper",
    reviewPath: "production/audio/voiceover_review.md",
    sourceWordCount: 42,
  };
}
