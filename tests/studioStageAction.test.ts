import { describe, expect, it } from "vitest";
import {
  stageActionForRun,
  studioStageActionConfigs,
} from "../apps/studio/src/lib/studioStageAction";

describe("Studio stage action mapping", () => {
  it("keeps every stage action id mapped once", () => {
    const actionIds = studioStageActionConfigs.map((config) => config.actionId);

    expect(new Set(actionIds).size).toBe(actionIds.length);
    expect(actionIds).toEqual(
      expect.arrayContaining([
        "ideas.run",
        "script.run",
        "render-plan.run",
        "render.review",
        "channel-handoff.run",
      ]),
    );
  });

  it("matches the guarded global ideas action without sending a run id", () => {
    expect(
      stageActionForRun({
        nextRecommendedCommand: " pnpm producer ideas --json ",
        runId: "run_new_context",
        state: "NEW",
      }),
    ).toMatchObject({
      actionId: "ideas.run",
      requiresRunId: false,
      routePath: "/actions/run-ideas",
    });
  });

  it("rejects global ideas commands that carry unexpected run scope", () => {
    expect(
      stageActionForRun({
        nextRecommendedCommand: "pnpm producer ideas --run run_new_context",
        runId: "run_new_context",
        state: "NEW",
      }),
    ).toBeNull();
  });

  it("matches command variations that keep the canonical producer command and run flag", () => {
    expect(
      stageActionForRun({
        nextRecommendedCommand: "  pnpm   producer   review   render   --json --run run_review ",
        runId: "run_review",
        state: "RENDERED",
      }),
    ).toMatchObject({
      actionId: "render.review",
      routePath: "/actions/review-render",
    });
  });

  it("rejects commands for a different run id", () => {
    expect(
      stageActionForRun({
        nextRecommendedCommand: "pnpm producer render --run run_other",
        runId: "run_review",
        state: "RENDER_APPROVED",
      }),
    ).toBeNull();
  });
});
