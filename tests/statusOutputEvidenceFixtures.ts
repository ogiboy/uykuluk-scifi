import { studioEvidenceFixture } from "./studioRunFixtures";

export function manualProductionEvidence(runId: string): Record<string, unknown> {
  return studioEvidenceFixture(runId, "READY_FOR_MANUAL_PRODUCTION", {
    nextRecommendedCommand: "pnpm producer approve render --run <run_id>",
    blockedActions: [
      "Render plan not generated; run pnpm producer render-plan --run <run_id> before TTS/render work.",
      "TTS disabled until configured and approved.",
    ],
    renderPlan: passRenderPlanEvidence(),
  });
}

export function blockedRenderedEvidence(runId: string): Record<string, unknown> {
  return studioEvidenceFixture(runId, "RENDERED", {
    draftRender: {
      status: "block",
      path: "production/render/draft.mp4",
      message: "Draft render output does not match manifest.",
    },
    nextRecommendedCommand: "Regenerate evidence; draft render artifacts are missing or blocked.",
    renderPlan: passRenderPlanEvidence(),
    voiceoverAudio: passVoiceoverEvidence(),
  });
}

export function passingRenderedEvidence(runId: string): Record<string, unknown> {
  return studioEvidenceFixture(runId, "RENDERED", {
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
      sourceFrameCount: 4,
      sourceFrameSegments: ["intro:2", "outro:2"],
      timelineSegments: ["intro", "scene", "outro"],
      voiceoverMode: "local-piper",
      voiceoverProductionVoiceCandidate: true,
      voiceoverQuality: "local-piper",
    },
    nextRecommendedCommand: "Manual final draft review. Upload remains approval-gated.",
    renderPlan: passRenderPlanEvidence(),
    voiceoverAudio: passVoiceoverEvidence(),
  });
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

function passVoiceoverEvidence(): Record<string, unknown> {
  return {
    status: "pass",
    path: "production/audio/voiceover.wav",
    digest: "b".repeat(64),
    durationSeconds: 8.2,
    mode: "local-piper",
    productionVoiceCandidate: true,
    quality: "local-piper",
    reviewPath: "production/audio/voiceover_review.md",
    sourceWordCount: 42,
  };
}
