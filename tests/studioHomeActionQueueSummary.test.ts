import { describe, expect, it } from "vitest";
import { homeActionQueueSummaryItems } from "../apps/studio/src/lib/homeActionQueueSummary";
import type { StudioActionWorkbenchRun } from "../apps/studio/src/lib/studioActionWorkbench";

describe("Studio home action queue summary", () => {
  it("summarizes guarded web, blocked CLI, CLI-only, and complete runs", () => {
    const items = homeActionQueueSummaryItems([
      actionRunFixture({ state: "READY_FOR_MANUAL_PRODUCTION" }),
      actionRunFixture({
        blockedActionCount: 1,
        nextRecommendedCommand: "Resolve evidence manually before continuing.",
        state: "FAILED",
      }),
      actionRunFixture({
        nextRecommendedCommand: "Inspect archived output manually.",
        state: "ARCHIVED",
      }),
      actionRunFixture({
        renderDecision: {
          kind: "present",
          nextAction: "Local draft-render decision is recorded.",
        },
        state: "RENDERED",
      }),
    ]);

    expect(Object.fromEntries(items.map((item) => [item.key, item.value]))).toEqual({
      blockedCli: 1,
      cliOnly: 1,
      complete: 1,
      webAction: 1,
    });
    expect(items).toContainEqual(
      expect.objectContaining({
        detail: "Guarded local routes can run from Studio.",
        key: "webAction",
        label: "Web actions",
        tone: "web",
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
    runId: "run_home_action_queue",
    state: "NEW",
    ...overrides,
  };
}
