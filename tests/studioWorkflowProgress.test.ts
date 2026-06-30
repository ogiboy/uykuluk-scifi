import { describe, expect, it } from "vitest";
import { getStudioRunDetail } from "../apps/studio/src/lib/runSummaries";
import { writeStudioRenderDecision } from "./studioRenderDecisionFixtures";
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

  it("marks Studio workflow operator decision done after a trusted local decision is recorded", async () => {
    const runId = await createRenderedStudioRunFixture();
    const decision = await writeStudioRenderDecision(runId, "accepted-for-local-review");
    const detail = await getStudioRunDetail(runId);

    expect(detail?.nextRecommendedCommand).toBe(decision.nextSafeAction);
    expect(detail?.renderDecision).toMatchObject({
      kind: "present",
      message: "Render decision recorded: accepted-for-local-review.",
      reviewCommand: `pnpm producer review render-decision --run ${runId}`,
    });
    expect(detail?.workflowProgress).toEqual(
      expect.arrayContaining([
        {
          detail: "Render decision recorded: accepted-for-local-review.",
          label: "Operator decision",
          status: "done",
        },
      ]),
    );
  });
});
