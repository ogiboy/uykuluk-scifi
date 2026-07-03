import { describe, expect, it } from "vitest";
import { getStudioActionServiceStatus } from "../apps/studio/src/lib/actionServiceStatus";

describe("Studio action service status", () => {
  it("summarizes the guarded local mutation and disabled risky routes", () => {
    const status = getStudioActionServiceStatus();

    expect(status).toMatchObject({
      actionCount: 8,
      disabledRouteCount: 2,
      findings: [],
      readyForCliCount: 6,
      riskyExternalCount: 2,
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
        actionId: "publish.schedule",
        availability: "disabled-external",
        routePath: "/actions/publish-schedule",
      }),
    );
  });
});
