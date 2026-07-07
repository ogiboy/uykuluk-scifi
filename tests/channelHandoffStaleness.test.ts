import { writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { artifactPath } from "../src/core/artifacts";
import { channelHandoffJsonPath, createChannelHandoff } from "../src/stages/channelHandoff";
import { createFinalReviewBundle } from "../src/stages/finalReviewBundle";
import { recordRenderDecision } from "../src/stages/renderDecision";
import { readRunStatus } from "../src/stages/status";
import { useTempProject } from "./helpers";
import { renderLocalDraft } from "./renderPipelineHelpers";

describe("manual channel handoff staleness", () => {
  useTempProject();

  it("treats legacy schema v1 channel handoffs as stale instead of invalid", async () => {
    const runId = await acceptedFinalReviewRun("channel-handoff-legacy");
    const handoff = await createChannelHandoff(runId);
    await writeFile(
      artifactPath(runId, channelHandoffJsonPath),
      JSON.stringify({ ...handoff, schemaVersion: 1 }),
      "utf8",
    );

    const status = await readRunStatus(runId);

    expect(status.channelHandoff).toMatchObject({
      kind: "stale",
      message: expect.stringContaining("legacy schema version 1"),
    });
    expect(status.nextRecommendedCommand).toBe(`pnpm producer channel-handoff --run ${runId}`);
  });

  it("marks channel handoffs stale when referenced thumbnail assets drift", async () => {
    const runId = await acceptedFinalReviewRun("channel-handoff-thumbnail-asset-drift");
    await createChannelHandoff(runId);
    await writeFile(
      path.join(process.cwd(), "assets/thumbnails/thumbnail_template_01_left_1280x720.jpg"),
      "changed thumbnail template",
      "utf8",
    );

    const status = await readRunStatus(runId);

    expect(status.channelHandoff).toMatchObject({
      kind: "stale",
      message: expect.stringContaining("Thumbnail asset changed"),
    });
    expect(status.nextRecommendedCommand).toBe(`pnpm producer channel-handoff --run ${runId}`);
  });
});

async function acceptedFinalReviewRun(scope: string): Promise<string> {
  const runId = await renderLocalDraft(scope);
  await recordRenderDecision({
    decision: "accepted-for-local-review",
    notes: "Draft is acceptable for local channel review.",
    reviewedBy: "operator",
    runId,
  });
  await createFinalReviewBundle(runId);
  return runId;
}
