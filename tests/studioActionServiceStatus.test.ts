import { describe, expect, it } from "vitest";
import { getStudioActionServiceStatus } from "../apps/studio/src/lib/actionServiceStatus";

describe("Studio action service status", () => {
  it("summarizes the guarded local mutation and disabled risky routes", () => {
    const status = getStudioActionServiceStatus();

    expect(status).toMatchObject({
      actionCount: 30,
      cliFallbackCount: 0,
      disabledRouteCount: 2,
      findings: [],
      readyForCliCount: 28,
      riskyExternalCount: 2,
      webReadyCount: 28,
      webMutationsEnabled: true,
    });
    expect(status.summaries).toContainEqual(
      expect.objectContaining({
        actionId: "idea.approve",
        availability: "ready-for-cli",
        routePath: "/actions/approve-idea",
      }),
    );
    expect(status.summaries).toContainEqual(
      expect.objectContaining({
        actionId: "render.decide",
        availability: "ready-for-cli",
        routePath: "/actions/decide-render",
      }),
    );
    expect(status.summaries).toContainEqual(
      expect.objectContaining({
        actionId: "channel-handoff.decide",
        availability: "ready-for-cli",
        routePath: "/actions/decide-channel-handoff",
      }),
    );
    expect(status.summaries).toContainEqual(
      expect.objectContaining({
        actionId: "render-plan.run",
        availability: "ready-for-cli",
        routePath: "/actions/run-render-plan",
      }),
    );
    expect(status.summaries).toContainEqual(
      expect.objectContaining({
        actionId: "doctor.run",
        availability: "ready-for-cli",
        routePath: "/actions/run-doctor",
      }),
    );
    expect(status.summaries).toContainEqual(
      expect.objectContaining({
        actionId: "model-eval.run",
        availability: "ready-for-cli",
        routePath: "/actions/run-model-eval",
      }),
    );
    expect(status.summaries).toContainEqual(
      expect.objectContaining({
        actionId: "model-eval-candidates.run",
        availability: "ready-for-cli",
        routePath: "/actions/run-model-eval-candidates",
      }),
    );
    expect(status.summaries).toContainEqual(
      expect.objectContaining({
        actionId: "ideas.run",
        availability: "ready-for-cli",
        routePath: "/actions/run-ideas",
      }),
    );
    expect(status.summaries).toContainEqual(
      expect.objectContaining({
        actionId: "voice.review",
        availability: "ready-for-cli",
        routePath: "/actions/review-voice",
      }),
    );
    expect(status.summaries).toContainEqual(
      expect.objectContaining({
        actionId: "publish.schedule",
        availability: "disabled-external",
        routePath: "/actions/publish-schedule",
      }),
    );
  });
});
