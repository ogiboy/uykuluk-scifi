import { describe, expect, it } from "vitest";
import {
  buildStudioActionWorkbench,
  type StudioActionWorkbenchRun,
} from "../apps/studio/src/lib/actions/studioActionWorkbench";

describe("Studio action workbench review priorities", () => {
  it("prioritizes render-plan review over estimate when review artifacts exist", () => {
    const workbench = buildStudioActionWorkbench(
      actionRunFixture({
        artifacts: [
          artifactPreview("production/render_plan.json"),
          artifactPreview("production/storyboard_contact_sheet.md"),
          artifactPreview("production/asset_provenance.json"),
        ],
        nextRecommendedCommand: "pnpm producer estimate --run run_workbench",
        state: "PRODUCTION_PACKAGE_GENERATED",
      }),
    );

    expect(workbench.primary).toEqual(
      expect.objectContaining({
        command: "pnpm producer review render-plan --run run_workbench",
        label: "Review Render Plan",
        routePath: "/actions/review-render-plan",
        tone: "available",
      }),
    );
  });

  it("prioritizes voiceover review before render approval when audio handoff exists", () => {
    const workbench = buildStudioActionWorkbench(
      actionRunFixture({
        artifacts: [
          artifactPreview("production/audio/voiceover.wav"),
          artifactPreview("production/audio/voiceover.meta.json"),
          artifactPreview("production/audio/voiceover_review.md"),
        ],
        nextRecommendedCommand: "pnpm producer approve render --run run_workbench",
        state: "READY_FOR_MANUAL_PRODUCTION",
      }),
    );

    expect(workbench.primary).toEqual(
      expect.objectContaining({
        command: "pnpm producer review voice --run run_workbench",
        label: "Review Voiceover",
        routePath: "/actions/review-voice",
        tone: "available",
      }),
    );
  });

  it("prioritizes draft-render review before recording a render decision", () => {
    const workbench = buildStudioActionWorkbench(
      actionRunFixture({
        artifacts: [
          artifactPreview("production/render/draft.mp4"),
          artifactPreview("production/render/render_manifest.json"),
          artifactPreview("production/render/draft_review.md"),
        ],
        renderDecisionCommands: [
          {
            command:
              "pnpm producer decide render --run run_workbench --decision accepted-for-local-review",
          },
        ],
        state: "RENDERED",
      }),
    );

    expect(workbench.primary).toEqual(
      expect.objectContaining({
        command: "pnpm producer review render --run run_workbench",
        label: "Review Draft Render",
        routePath: "/actions/review-render",
        tone: "available",
      }),
    );
  });
});

function actionRunFixture(
  overrides: Partial<StudioActionWorkbenchRun> = {},
): StudioActionWorkbenchRun {
  return {
    blockedActionCount: 0,
    channelHandoff: { kind: "missing" },
    channelHandoffDecision: { kind: "missing", nextAction: null },
    nextRecommendedCommand: null,
    readinessStatus: "passed",
    renderDecision: { kind: "missing", nextAction: null },
    renderDecisionCommands: [],
    runId: "run_workbench",
    state: "NEW",
    ...overrides,
  };
}

function artifactPreview(path: string): NonNullable<StudioActionWorkbenchRun["artifacts"]>[number] {
  return { exists: true, path };
}
