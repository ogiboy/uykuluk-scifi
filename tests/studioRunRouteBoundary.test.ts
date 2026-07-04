import { describe, expect, it } from "vitest";
import {
  runDetailErrorCopy,
  runDetailNotFoundCopy,
} from "../apps/studio/src/lib/runRouteBoundaryCopy";

describe("Studio run route boundaries", () => {
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
