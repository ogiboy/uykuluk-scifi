import { describe, expect, it } from "vitest";
import {
  formatRunRenderDecision,
  formatRunReviewCounts,
} from "../apps/studio/src/lib/runSummaryCopy";

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
            renderApproval: {
              approvalId: "approval_render_fixture",
              approvedRef: "b".repeat(64),
            },
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
        },
      }),
    ).toBe("needs-revision by operator");
  });
});
