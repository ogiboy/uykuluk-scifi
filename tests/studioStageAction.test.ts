import { describe, expect, it } from "vitest";
import {
  stageActionForRun,
  studioStageActionConfigs,
} from "../apps/studio/src/lib/actions/studioStageAction";

describe("Studio stage action mapping", () => {
  it("keeps every stage action id mapped once", () => {
    const actionIds = studioStageActionConfigs.map((config) => config.actionId);

    expect(new Set(actionIds).size).toBe(actionIds.length);
    expect(actionIds).toEqual(
      expect.arrayContaining([
        "script.run",
        "render-plan.run",
        "render.review",
        "render.revise",
        "channel-handoff.run",
      ]),
    );
  });

  it("does not map global ideas generation as a run-bound stage action", () => {
    expect(
      stageActionForRun({
        nextRecommendedCommand: " pnpm producer ideas --json ",
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
    ).toMatchObject({ actionId: "render.review", routePath: "/actions/review-render" });
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

  it("maps the canonical rejected-draft recovery command to its guarded route", () => {
    expect(
      stageActionForRun({
        nextRecommendedCommand: "pnpm producer revise render --run run_review",
        runId: "run_review",
        state: "RENDERED",
      }),
    ).toMatchObject({ actionId: "render.revise", routePath: "/actions/revise-render" });
  });
});
