import { describe, expect, it } from "vitest";
import { getStudioActionServiceStatus } from "../apps/studio/src/lib/actionServiceStatus";
import {
  actionSurface,
  filterServiceContractGroups,
  serviceContractGroups,
} from "../apps/studio/src/lib/serviceContractPanel";

describe("Studio service contract panel helpers", () => {
  it("filters action contracts by query and availability", () => {
    const groups = serviceContractGroups(getStudioActionServiceStatus().summaries);

    const renderMatches = filterServiceContractGroups(groups, "render", "ready-for-cli");
    expect(renderMatches.flatMap((group) => group.summaries)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ actionId: "render-plan.run" }),
        expect.objectContaining({ actionId: "render.review" }),
      ]),
    );
    expect(
      renderMatches
        .flatMap((group) => group.summaries)
        .every((summary) => summary.availability === "ready-for-cli"),
    ).toBe(true);

    const disabledMatches = filterServiceContractGroups(groups, "publish", "disabled-external");
    expect(disabledMatches).toHaveLength(1);
    expect(disabledMatches[0]?.summaries).toEqual([
      expect.objectContaining({ actionId: "publish.schedule" }),
    ]);

    expect(filterServiceContractGroups(groups, "no-such-action", "all")).toEqual([]);
  });

  it("links action contracts to operator surfaces instead of API routes", () => {
    expect(actionSurface("analytics.import")).toMatchObject({ href: "/analytics" });
    expect(actionSurface("doctor.run")).toMatchObject({ href: "/doctor" });
    expect(actionSurface("model-eval.run")).toMatchObject({ href: "/eval" });
    expect(actionSurface("model-eval-candidates.run")).toMatchObject({ href: "/eval" });
    expect(actionSurface("ideas.run")).toMatchObject({ href: "/" });
    expect(actionSurface("render.run")).toMatchObject({ href: "/runs" });
  });
});
