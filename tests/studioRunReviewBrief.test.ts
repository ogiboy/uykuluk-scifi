import { describe, expect, it } from "vitest";
import { buildStudioRunReviewBrief } from "../apps/studio/src/lib/runReviewBrief";
import type { StudioRunDetail } from "../apps/studio/src/lib/runSummaries";

type FinalReviewBundleFixture = Extract<
  StudioRunDetail["finalReviewBundle"],
  { kind: "present" }
>["bundle"];

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

    expect(brief).toMatchObject({
      severity: "ready",
      title: "Draft review decision needed",
    });
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
          decision: {
            decision: "accepted-for-local-review",
            reviewedBy: "operator",
          } as StudioRunDetail["renderDecision"] extends { decision: infer Decision }
            ? Decision
            : never,
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

  it("does not mark missing media artifacts as complete", () => {
    const brief = buildStudioRunReviewBrief(
      runBriefFixture({
        productionMedia: [],
      }),
    );

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
    const bundle: FinalReviewBundleFixture = {
      acceptedFor: {
        localReview: true,
        privateUpload: false,
        publicPublish: false,
      },
      channelPrep: {
        chaptersReady: true,
        metadataReady: true,
        thumbnailCandidatesReady: true,
      },
      createdAt: "2026-07-03T21:00:00.000Z",
      draftRender: {
        digest: "a".repeat(64),
        path: "production/render/draft.mp4",
      },
      operatorDecision: {
        createdAt: "2026-07-03T20:00:00.000Z",
        decision: "accepted-for-local-review",
        digest: "b".repeat(64),
        path: "production/review/render_decision.json",
      },
      reviewMarkdownPath: "production/review/final_review_bundle.md",
      runId: "run_brief",
      schemaVersion: 2,
      status: "accepted-for-local-review",
    };
    const brief = buildStudioRunReviewBrief(
      runBriefFixture({
        finalReviewBundle: {
          bundle,
          kind: "present",
          message: "Final review bundle ready: accepted-for-local-review.",
          nextAction: "pnpm producer channel-handoff --run run_brief",
          reviewPath: "production/review/final_review_bundle.md",
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
});

function runBriefFixture(
  overrides: Partial<Parameters<typeof buildStudioRunReviewBrief>[0]> = {},
): Parameters<typeof buildStudioRunReviewBrief>[0] {
  const fixture = {
    blockedActionCount: 0,
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

  return fixture as Parameters<typeof buildStudioRunReviewBrief>[0];
}
