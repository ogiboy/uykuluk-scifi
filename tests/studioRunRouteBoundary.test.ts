import { describe, expect, it } from "vitest";
import {
  runDetailErrorCopy,
  runDetailNotFoundCopy,
  studioErrorCopy,
  studioForbiddenCopy,
  studioNotFoundCopy,
  studioUnauthorizedCopy,
} from "../apps/studio/src/lib/routing/studioRouteBoundaryCopy";

describe("Studio run route boundaries", () => {
  it("keeps global route boundaries fail-closed and non-mutating", () => {
    expect(studioNotFoundCopy).toMatchObject({
      heading: "Studio route not found",
      status: "No action taken",
    });
    expect(studioNotFoundCopy.description).toContain("Missing routes and missing files");
    expect(studioNotFoundCopy.description).toContain("upload permission");
    expect(studioNotFoundCopy.description).toContain("publish permission");

    expect(studioErrorCopy).toMatchObject({
      heading: "Studio page failed safely",
      status: "No action taken",
    });
    expect(studioErrorCopy.description).toContain("did not retry approvals");
    expect(studioErrorCopy.description).toContain("change run state");
    expect(studioErrorCopy.description).toContain("infer readiness from local files");
  });

  it("keeps local trust boundaries explicit for blocked web-control attempts", () => {
    expect(studioForbiddenCopy).toMatchObject({
      heading: "Studio action blocked",
      status: "Request blocked",
    });
    expect(studioForbiddenCopy.description).toContain("before it reached CLI/core execution");
    expect(studioForbiddenCopy.description).toContain("same-origin access");

    expect(studioUnauthorizedCopy).toMatchObject({
      heading: "Local web session required",
      primaryActionHref: "/",
      primaryActionLabel: "Open operator desk session controls",
      status: "Session required",
    });
    expect(studioUnauthorizedCopy.description).toContain("valid local web-control session");
    expect(studioUnauthorizedCopy.description).toContain("No producer state was changed");
  });

  it("keeps missing run recovery fail-closed and operator-facing", () => {
    expect(runDetailNotFoundCopy).toMatchObject({
      heading: "Run not found",
      status: "No action taken",
    });
    expect(runDetailNotFoundCopy.description).toContain("Missing run files never imply approval");
    expect(runDetailNotFoundCopy.description).toContain("upload permission");
    expect(runDetailNotFoundCopy.description).toContain("publish permission");
  });

  it("keeps run-detail read failures local and non-mutating", () => {
    expect(runDetailErrorCopy).toMatchObject({
      heading: "Run review failed safely",
      status: "No action taken",
    });
    expect(runDetailErrorCopy.description).toContain("did not retry approvals");
    expect(runDetailErrorCopy.description).toContain("change run state");
    expect(runDetailErrorCopy.description).toContain("upload media");
    expect(runDetailErrorCopy.description).toContain("publish content");
  });
});
