import { describe, expect, it } from "vitest";
import { getStudioRunDetail } from "../apps/studio/src/lib/runSummaries";
import { createRenderedStudioRunFixture } from "./studioRunFixtures";
import { useTempProject } from "./helpers";

describe("Studio workflow progress", () => {
  useTempProject();

  it("shows read-only v1 workflow progress on rendered runs", async () => {
    const runId = await createRenderedStudioRunFixture();
    const detail = await getStudioRunDetail(runId);

    expect(detail?.workflowProgress).toEqual(
      expect.arrayContaining([
        {
          detail: "Verified by current evidence.",
          label: "Draft render",
          status: "done",
        },
        {
          detail: "Record the operator decision after local draft review.",
          label: "Operator decision",
          status: "current",
        },
      ]),
    );
  });
});
