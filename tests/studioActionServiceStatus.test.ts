import { describe, expect, it } from "vitest";
import { getStudioActionServiceStatus } from "../apps/studio/src/lib/actionServiceStatus";

describe("Studio action service status", () => {
  it("summarizes disabled web mutations and shared CLI contracts", () => {
    const status = getStudioActionServiceStatus();

    expect(status).toMatchObject({
      actionCount: 7,
      disabledRouteCount: 7,
      findings: [],
      readyForCliCount: 5,
      riskyExternalCount: 2,
      webMutationsEnabled: false,
    });
    expect(status.summaries).toContainEqual(
      expect.objectContaining({
        actionId: "render.decide",
        availability: "ready-for-cli",
        routePath: "/actions/decide-render",
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
