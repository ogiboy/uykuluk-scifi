import { describe, expect, it } from "vitest";
import {
  formatRunChannelHandoffDecision,
  formatRunFinalReviewBundle,
  formatRunRenderDecision,
  formatRunReviewCounts,
} from "../apps/studio/src/lib/runs/runSummaryCopy";

describe("Studio run summary table copy", () => {
  it("formats approval, warning, and artifact counts for the run index", () => {
    expect(formatRunReviewCounts({ approvalCount: 2, artifactCount: 9, warningCount: 1 })).toBe(
      "2 approvals · 1 warnings · 9 artifacts",
    );
  });

  it("formats render decisions for compact run surfaces", () => {
    expect(
      formatRunRenderDecision({
        renderDecision: {
          kind: "missing",
          message: "Render decision has not been recorded.",
          nextAction: null,
        },
      }),
    ).toBe("missing");
    expect(
      formatRunRenderDecision({
        renderDecision: {
          decision: {
            blockedActions: [],
            createdAt: "2026-06-28T00:00:00.000Z",
            decision: "needs-revision",
            draftRender: {
              durationSeconds: 8,
              path: "production/render/draft.mp4",
              reviewCommand: "ffmpeg -i production/render/draft.mp4 -f null -",
              sha256: "a".repeat(64),
            },
            nextSafeAction: "Revise the draft.",
            notes: "Needs another subtitle pass.",
            renderApproval: { approvalId: "approval_render_fixture", approvedRef: "b".repeat(64) },
            reviewedBy: "operator",
            runId: "run_202606280001_decision",
            schemaVersion: 1,
            voiceover: {
              mode: "local-piper",
              productionVoiceCandidate: true,
              quality: "local-piper",
            },
          },
          kind: "present",
          message: "Render decision recorded: needs-revision.",
          nextAction: "Revise the draft.",
          reviewCommand: "pnpm producer review render-decision --run run_202606280001_decision",
        },
      }),
    ).toBe("needs-revision by operator");
  });

  it("formats final review bundles for compact run surfaces", () => {
    expect(
      formatRunFinalReviewBundle({
        finalReviewBundle: {
          kind: "missing",
          message: "Final review bundle has not been generated.",
          nextAction: "pnpm producer review-bundle --run run_202606280001_bundle",
        },
      }),
    ).toBe("missing");
    expect(
      formatRunFinalReviewBundle({
        finalReviewBundle: {
          bundle: {
            artifacts: [{ label: "Draft", operatorAction: "Review", path: "x", reviewPhase: "y" }],
            blockedActions: [],
            createdAt: "2026-06-28T00:00:00.000Z",
            draftRender: {
              chapters: {
                jsonPath: "production/render/youtube_chapters.json",
                jsonSha256: "b".repeat(64),
                markdownPath: "production/render/youtube_chapters.md",
                markdownSha256: "c".repeat(64),
              },
              durationSeconds: 8,
              manifestPath: "production/render/render_manifest.json",
              media: { audioCodec: "aac", height: 720, videoCodec: "h264", width: 1280 },
              path: "production/render/draft.mp4",
              reviewCommand: "ffmpeg -i production/render/draft.mp4 -f null -",
              reviewPath: "production/render/draft_review.md",
              sha256: "a".repeat(64),
            },
            nextSafeAction: "Local final review handoff is ready.",
            renderDecision: {
              createdAt: "2026-06-28T00:00:00.000Z",
              decision: "accepted-for-local-review",
              kind: "present",
              nextSafeAction: "Local final review handoff is ready.",
              notes: "Reviewed.",
              reviewCommand: "pnpm producer review render-decision --run run_202606280001_bundle",
              reviewedBy: "operator",
            },
            renderPlan: {
              assetProvenancePath: "production/asset_provenance.json",
              contactSheetPath: "production/storyboard_contact_sheet.md",
              estimatedDraftDurationSeconds: 8,
              path: "production/render_plan.json",
              sceneCount: 1,
            },
            runId: "run_202606280001_bundle",
            schemaVersion: 2,
            status: "accepted-for-local-review",
            summary: "Ready.",
            voiceover: {
              mode: "local-piper",
              path: "production/audio/voiceover.wav",
              productionVoiceCandidate: true,
              quality: "local-piper",
              renderApprovalScope: "approval",
              reviewPath: "production/audio/voiceover_review.md",
            },
          },
          kind: "present",
          message: "Final review bundle ready: accepted-for-local-review.",
          nextAction: "Local final review handoff is ready.",
          reviewPath: "production/review_bundle.md",
        },
      }),
    ).toBe("accepted-for-local-review");
  });

  it("formats manual channel handoff decisions for compact run surfaces", () => {
    expect(
      formatRunChannelHandoffDecision({
        channelHandoffDecision: {
          kind: "missing",
          message: "Manual channel-handoff decision has not been recorded.",
          nextAction:
            "pnpm producer decide channel-handoff --run run_202606280001_channel --decision accepted-for-manual-channel-prep --thumbnail-candidate <candidate_id> --notes '<operator notes>' --reviewed-by operator",
        },
      }),
    ).toBe("missing");
    expect(
      formatRunChannelHandoffDecision({
        channelHandoffDecision: {
          decision: {
            blockedActions: [
              "This decision does not call YouTube APIs or create a private upload.",
            ],
            channelHandoff: {
              digest: "a".repeat(64),
              path: "production/channel_handoff.json",
              status: "ready-for-manual-channel-review",
            },
            createdAt: "2026-06-28T00:00:00.000Z",
            decision: "accepted-for-manual-channel-prep",
            manualOnly: true,
            nextSafeAction: "Private upload remains disabled.",
            notes: "Reviewed.",
            reviewedBy: "operator",
            runId: "run_202606280001_channel",
            schemaVersion: 1,
            selectedThumbnailCandidate: {
              candidateId: "thumbnail-01-left",
              templatePath: "assets/thumbnails/thumbnail_template_01_left_1280x720.jpg",
              templateSha256: "b".repeat(64),
            },
            youtube: { metadataPath: "production/youtube_metadata.json", title: "Fixture title" },
          },
          kind: "present",
          message: "Channel handoff decision recorded: accepted-for-manual-channel-prep.",
          nextAction: "Private upload remains disabled.",
          reviewPath: "production/channel_handoff_decision.md",
        },
      }),
    ).toBe("accepted-for-manual-channel-prep by operator");
  });
});
