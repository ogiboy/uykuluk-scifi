import { describe, expect, it } from "vitest";
import { getStudioActionServiceStatus } from "../apps/studio/src/lib/actionServiceStatus";

describe("Studio action service status", () => {
  it("summarizes disabled web mutations and shared CLI contracts", () => {
    const status = getStudioActionServiceStatus();

    expect(status).toMatchObject({
      actionCount: 6,
      disabledRouteCount: 6,
      findings: [],
      readyForCliCount: 4,
      riskyExternalCount: 2,
      webMutationsEnabled: false,
    });
    expect(status.summaries).toContainEqual(
      expect.objectContaining({
        actionId: "publish.schedule",
        availability: "disabled-external",
        routePath: "/actions/publish-schedule",
      }),
    );
  });
});
