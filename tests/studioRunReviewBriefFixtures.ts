import { buildStudioRunReviewBrief } from "../apps/studio/src/lib/runs/runReviewBrief";
import type { StudioRunDetail } from "../apps/studio/src/lib/runSummaries";

type FinalReviewBundleFixture = Extract<
  StudioRunDetail["finalReviewBundle"],
  { kind: "present" }
>["bundle"];
type RenderDecisionFixture = Extract<
  StudioRunDetail["renderDecision"],
  { kind: "present" }
>["decision"];
type ChannelHandoffDecisionFixture = Extract<
  StudioRunDetail["channelHandoffDecision"],
  { kind: "present" }
>["decision"];
type ChannelHandoffFixture = Extract<
  StudioRunDetail["channelHandoff"],
  { kind: "present" }
>["handoff"];

export function acceptedRenderDecision(): RenderDecisionFixture {
  return {
    blockedActions: [],
    createdAt: "2026-07-03T20:00:00.000Z",
    decision: "accepted-for-local-review",
    draftRender: {
      durationSeconds: 42,
      path: "production/render/draft.mp4",
      reviewCommand: "pnpm producer review render --run run_brief",
      sha256: "e".repeat(64),
    },
    nextSafeAction: "pnpm producer review-bundle --run run_brief",
    notes: "Accepted for local review.",
    renderApproval: { approvalId: "approval_render_1", approvedRef: "2".repeat(64) },
    reviewedBy: "operator",
    runId: "run_brief",
    schemaVersion: 1,
    voiceover: { mode: "production", productionVoiceCandidate: true, quality: "high" },
  };
}

export function finalReviewBundleFixture(): FinalReviewBundleFixture {
  return {
    artifacts: [
      {
        label: "Draft render",
        operatorAction: "Watch the local draft render.",
        path: "production/render/draft.mp4",
        reviewPhase: "local-review",
      },
    ],
    blockedActions: [
      "Private YouTube upload disabled by default.",
      "Public/scheduled publish disabled by default.",
    ],
    createdAt: "2026-07-03T21:00:00.000Z",
    draftRender: {
      chapters: {
        jsonPath: "production/chapters.json",
        jsonSha256: "3".repeat(64),
        markdownPath: "production/chapters.md",
        markdownSha256: "4".repeat(64),
      },
      durationSeconds: 42,
      manifestPath: "production/render/draft_render_manifest.json",
      media: { audioCodec: "pcm_s16le", height: 1080, videoCodec: "h264", width: 1920 },
      path: "production/render/draft.mp4",
      reviewCommand: "pnpm producer review render --run run_brief",
      reviewPath: "production/review/render_review.md",
      sha256: "e".repeat(64),
    },
    nextSafeAction: "pnpm producer channel-handoff --run run_brief",
    renderDecision: {
      createdAt: "2026-07-03T20:00:00.000Z",
      decision: "accepted-for-local-review",
      kind: "present",
      nextSafeAction: "pnpm producer review-bundle --run run_brief",
      notes: "Accepted for local review.",
      reviewCommand: "pnpm producer review render-decision --run run_brief",
      reviewedBy: "operator",
    },
    renderPlan: {
      assetProvenancePath: "production/asset_provenance.json",
      contactSheetPath: "production/storyboard_contact_sheet.md",
      estimatedDraftDurationSeconds: 42,
      path: "production/render_plan.json",
      sceneCount: 3,
    },
    runId: "run_brief",
    schemaVersion: 2,
    status: "accepted-for-local-review",
    summary: "Local review bundle accepted.",
    voiceover: {
      mode: "production",
      path: "production/audio/voiceover.wav",
      productionVoiceCandidate: true,
      quality: "high",
      renderApprovalScope: "current-render-inputs",
      reviewPath: "production/review/voiceover_review.md",
    },
  };
}

export function channelHandoffDecisionFixture(): ChannelHandoffDecisionFixture {
  return {
    blockedActions: [
      "Private YouTube upload disabled by default.",
      "Public/scheduled publish disabled by default.",
    ],
    channelHandoff: {
      digest: "c".repeat(64),
      path: "production/channel_handoff.json",
      status: "ready-for-manual-channel-review",
    },
    createdAt: "2026-07-03T22:00:00.000Z",
    decision: "accepted-for-manual-channel-prep",
    manualOnly: true,
    nextSafeAction: "Keep the selected thumbnail, metadata, chapters, subtitles, and MP4 together.",
    notes: "Accepted for manual channel preparation.",
    reviewedBy: "operator",
    runId: "run_brief",
    schemaVersion: 1,
    selectedThumbnailCandidate: null,
    youtube: { metadataPath: "production/youtube_metadata.json", title: "UykulukSciFi test title" },
  };
}

export function channelHandoffFixture(): ChannelHandoffFixture {
  return {
    blockedActions: [
      "Private YouTube upload disabled by default.",
      "Public/scheduled publish disabled by default.",
    ],
    createdAt: "2026-07-03T21:30:00.000Z",
    finalReviewBundle: {
      digest: "d".repeat(64),
      markdownPath: "production/review_bundle.md",
      path: "production/review_bundle.json",
      status: "accepted-for-local-review",
    },
    manualOnly: true,
    media: {
      chaptersJsonPath: "production/chapters.json",
      chaptersPath: "production/chapters.md",
      draftRenderPath: "production/render/draft.mp4",
      draftRenderSha256: "e".repeat(64),
      durationSeconds: 42,
      renderReviewPath: "production/review/render_review.md",
      subtitlesPath: "production/subtitles.srt",
    },
    nextSafeAction: "Keep the selected thumbnail, metadata, chapters, subtitles, and MP4 together.",
    operatorChecklist: ["Watch the local draft render before manual upload preparation."],
    runId: "run_brief",
    schemaVersion: 2,
    status: "ready-for-manual-channel-review",
    thumbnailCandidates: {
      jsonPath: "production/thumbnail_candidates.json",
      jsonSha256: "f".repeat(64),
      markdownPath: "production/thumbnail_candidates.md",
      markdownSha256: "1".repeat(64),
      recommendedCandidateId: "thumb_1",
    },
    youtube: {
      description: "Description.",
      metadataPath: "production/youtube_metadata.json",
      tags: ["uykuluk", "scifi"],
      title: "UykulukSciFi test title",
    },
  };
}

export function runBriefFixture(
  overrides: Partial<Parameters<typeof buildStudioRunReviewBrief>[0]> = {},
): Parameters<typeof buildStudioRunReviewBrief>[0] {
  const fixture = {
    blockedActionCount: 0,
    blockedActions: [],
    channelHandoff: { kind: "missing", message: "Missing.", nextAction: null },
    channelHandoffDecision: { kind: "missing", message: "Missing.", nextAction: null },
    evidenceStatus: "available",
    finalReviewBundle: { kind: "missing", message: "Missing.", nextAction: null },
    nextRecommendedCommand: "pnpm producer review render --run run_brief",
    productionMedia: [
      {
        artifactPath: "production/render_plan.json",
        evidenceKey: "renderPlan",
        label: "Render plan",
        status: "pass",
      },
      {
        artifactPath: "production/audio/voiceover.wav",
        evidenceKey: "voiceoverAudio",
        label: "Voiceover audio",
        status: "pass",
      },
      {
        artifactPath: "production/render/draft.mp4",
        evidenceKey: "draftRender",
        label: "Draft render",
        status: "pass",
      },
    ],
    readinessStatus: "passed",
    renderDecision: {
      kind: "missing",
      message: "Render decision has not been recorded.",
      nextAction: null,
    },
    state: "RENDERED",
    ...overrides,
  } satisfies Partial<StudioRunDetail>;

  return fixture;
}
