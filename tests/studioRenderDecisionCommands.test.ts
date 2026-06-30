import { describe, expect, it } from "vitest";
import { getStudioRunDetail } from "../apps/studio/src/lib/runSummaries";
import { loadRun, saveRun } from "../src/core/runStore";
import { useTempProject } from "./helpers";
import { writeStudioRenderDecision } from "./studioRenderDecisionFixtures";
import { createRenderedStudioRunFixture } from "./studioRunFixtures";

describe("Studio render decision commands", () => {
  useTempProject();

  it("shows local render decision commands for rendered runs without a recorded decision", async () => {
    const runId = await createRenderedStudioRunFixture();
    const detail = await getStudioRunDetail(runId);

    expect(detail?.renderDecisionCommands).toEqual(
      expect.arrayContaining([
        {
          command: expect.stringContaining(`pnpm producer decide render --run ${runId}`),
          decision: "accepted-for-local-review",
          guidance: expect.stringContaining("complete local draft"),
        },
        {
          command: expect.stringContaining("--decision needs-revision"),
          decision: "needs-revision",
          guidance: expect.stringContaining("another pass"),
        },
        {
          command: expect.stringContaining("--decision rejected"),
          decision: "rejected",
          guidance: expect.stringContaining("should not be used"),
        },
      ]),
    );
  });

  it("hides local render decision commands after a decision artifact is recorded", async () => {
    const runId = await createRenderedStudioRunFixture();
    await writeStudioRenderDecision(runId);

    const detail = await getStudioRunDetail(runId);

    expect(detail?.renderDecisionCommands).toEqual([]);
    expect(detail?.renderDecision).toMatchObject({
      kind: "present",
      decision: {
        decision: "accepted-for-local-review",
        reviewedBy: "operator",
      },
    });
  });

  it("keeps local render decision commands hidden when a recorded decision artifact is missing", async () => {
    const runId = await createRenderedStudioRunFixture();
    const run = await loadRun(runId);
    await saveRun({
      ...run,
      artifacts: [...run.artifacts, "production/render/render_decision.json"],
    });

    const detail = await getStudioRunDetail(runId);

    expect(detail?.renderDecisionCommands).toEqual([]);
    expect(detail?.renderDecision).toMatchObject({
      kind: "missing",
      message: "Render decision is listed in run artifacts but the JSON file is missing.",
    });
  });
});
