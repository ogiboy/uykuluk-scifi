import { describe, expect, it } from "vitest";
import { buildStudioRunReviewBrief } from "../apps/studio/src/lib/runReviewBrief";
import {
  privateUploadDisabledBlockedAction,
  publicPublishDisabledBlockedAction,
} from "../src/stages/evidenceBlockedActions";
import {
  acceptedRenderDecision,
  channelHandoffDecisionFixture,
  channelHandoffFixture,
  finalReviewBundleFixture,
  runBriefFixture,
} from "./studioRunReviewBriefFixtures";

describe("Studio run review brief", () => {
  it("prioritizes blocked actions before media or decision guidance", () => {
    const brief = buildStudioRunReviewBrief(
      runBriefFixture({
        blockedActionCount: 2,
        nextRecommendedCommand: "pnpm producer evidence --run run_brief_blocked",
      }),
    );

    expect(brief).toMatchObject({
      primaryAction: "pnpm producer evidence --run run_brief_blocked",
      severity: "blocked",
      title: "2 blocked actions",
    });
    expect(brief.checkpoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Evidence", status: "done" }),
        expect.objectContaining({ label: "Media", status: "done" }),
      ]),
    );
  });

  it("guides rendered runs toward a durable operator decision", () => {
    const brief = buildStudioRunReviewBrief(
      runBriefFixture({
        nextRecommendedCommand:
          "pnpm producer decide render --run run_brief_rendered --decision accepted-for-local-review --notes '<operator notes>' --reviewed-by operator",
        state: "RENDERED",
      }),
    );

    expect(brief).toMatchObject({ severity: "ready", title: "Draft review decision needed" });
    expect(brief.summary).toContain("Record one durable operator decision");
    expect(brief.checkpoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          detail: "No local draft-render decision is recorded yet.",
          label: "Operator decision",
          status: "pending",
        }),
      ]),
    );
  });

  it("guides accepted render decisions toward final review bundle generation", () => {
    const brief = buildStudioRunReviewBrief(
      runBriefFixture({
        finalReviewBundle: {
          kind: "missing",
          message: "Final review bundle has not been generated.",
          nextAction: "pnpm producer review-bundle --run run_brief_bundle",
        },
        nextRecommendedCommand: "pnpm producer review-bundle --run run_brief_bundle",
        renderDecision: {
          decision: acceptedRenderDecision(),
          kind: "present",
          message: "Render decision recorded: accepted-for-local-review.",
          nextAction: "pnpm producer review-bundle --run run_brief_bundle",
          reviewCommand: "pnpm producer review render-decision --run run_brief_bundle",
        },
        state: "RENDERED",
      }),
    );

    expect(brief).toMatchObject({
      primaryAction: "pnpm producer review-bundle --run run_brief_bundle",
      severity: "ready",
      title: "Final review bundle next",
    });
    expect(brief.checkpoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          detail: "Render decision recorded: accepted-for-local-review.",
          label: "Operator decision",
          status: "done",
        }),
      ]),
    );
  });

  it("does not let expected upload and publish guards hide the next local review action", () => {
    const brief = buildStudioRunReviewBrief(
      runBriefFixture({
        blockedActionCount: 2,
        blockedActions: [privateUploadDisabledBlockedAction, publicPublishDisabledBlockedAction],
        finalReviewBundle: {
          kind: "missing",
          message: "Final review bundle has not been generated.",
          nextAction: "pnpm producer review-bundle --run run_brief_bundle",
        },
        nextRecommendedCommand: "pnpm producer review-bundle --run run_brief_bundle",
        renderDecision: {
          decision: acceptedRenderDecision(),
          kind: "present",
          message: "Render decision recorded: accepted-for-local-review.",
          nextAction: "pnpm producer review-bundle --run run_brief_bundle",
          reviewCommand: "pnpm producer review render-decision --run run_brief_bundle",
        },
        state: "RENDERED",
      }),
    );

    expect(brief).toMatchObject({
      primaryAction: "pnpm producer review-bundle --run run_brief_bundle",
      severity: "ready",
      title: "Final review bundle next",
    });
  });

  it("does not mark missing media artifacts as complete", () => {
    const brief = buildStudioRunReviewBrief(runBriefFixture({ productionMedia: [] }));

    expect(brief.checkpoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          detail: "0/0 media artifacts are verified by current evidence.",
          label: "Media",
          status: "pending",
        }),
      ]),
    );
  });

  it("surfaces stale render decisions as operator attention", () => {
    const brief = buildStudioRunReviewBrief(
      runBriefFixture({
        renderDecision: {
          kind: "stale",
          message: "Render decision was recorded for an older draft render.",
          nextAction:
            "pnpm producer decide render --run run_brief --decision needs-revision --notes '<operator notes>' --reviewed-by operator",
        },
      }),
    );

    expect(brief.checkpoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          detail: "Render decision was recorded for an older draft render.",
          label: "Operator decision",
          status: "attention",
        }),
      ]),
    );
  });

  it("marks final handoff as ready when the trusted final review bundle exists", () => {
    const brief = buildStudioRunReviewBrief(
      runBriefFixture({
        finalReviewBundle: {
          bundle: finalReviewBundleFixture(),
          kind: "present",
          message: "Final review bundle ready: accepted-for-local-review.",
          nextAction: "pnpm producer channel-handoff --run run_brief",
          reviewPath: "production/review/final_review_bundle.md",
        },
        renderDecision: {
          decision: acceptedRenderDecision(),
          kind: "present",
          message: "Render decision recorded: accepted-for-local-review.",
          nextAction: "pnpm producer review-bundle --run run_brief_bundle",
          reviewCommand: "pnpm producer review render-decision --run run_brief_bundle",
        },
      }),
    );

    expect(brief.checkpoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          detail: "Final review bundle is ready for manual channel handoff preparation.",
          label: "Final handoff",
          status: "ready",
        }),
      ]),
    );
  });

  it("summarizes completed manual channel handoff decisions without treating publish guards as local blockers", () => {
    const brief = buildStudioRunReviewBrief(
      runBriefFixture({
        blockedActionCount: 2,
        blockedActions: [privateUploadDisabledBlockedAction, publicPublishDisabledBlockedAction],
        channelHandoff: {
          handoff: channelHandoffFixture(),
          kind: "present",
          message: "Manual channel handoff package is ready for local operator review.",
          nextAction:
            "Keep the selected thumbnail, metadata, chapters, subtitles, and MP4 together.",
          reviewPath: "production/channel_handoff.md",
        },
        channelHandoffDecision: {
          decision: channelHandoffDecisionFixture(),
          kind: "present",
          message: "Channel handoff decision recorded: accepted-for-manual-channel-prep.",
          nextAction:
            "Keep the selected thumbnail, metadata, chapters, subtitles, and MP4 together.",
          reviewPath: "production/review/channel_handoff_decision.md",
        },
        finalReviewBundle: {
          bundle: finalReviewBundleFixture(),
          kind: "present",
          message: "Final review bundle ready: accepted-for-local-review.",
          nextAction: "pnpm producer channel-handoff --run run_brief",
          reviewPath: "production/review/final_review_bundle.md",
        },
        renderDecision: {
          decision: acceptedRenderDecision(),
          kind: "present",
          message: "Render decision recorded: accepted-for-local-review.",
          nextAction: "pnpm producer review-bundle --run run_brief_bundle",
          reviewCommand: "pnpm producer review render-decision --run run_brief_bundle",
        },
      }),
    );

    expect(brief).toMatchObject({ severity: "review", title: "Manual channel package ready" });
    expect(brief.summary).toContain("upload and publish remain guarded");
  });
});
