import { mkdir, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { artifactPath } from "../src/core/artifacts";
import { createRun, saveRun } from "../src/core/runStore";
import { formatRunStatus, readRunStatus } from "../src/stages/status";
import { useTempProject } from "./helpers";

describe("status evidence validity", () => {
  useTempProject();

  it("marks evidence generated for a previous run state as stale", async () => {
    const run = await createRun();
    await saveRun({
      ...run,
      artifacts: ["evidence_bundle.json"],
      state: "SCRIPT_APPROVED",
    });
    await writeFile(
      artifactPath(run.runId, "evidence_bundle.json"),
      JSON.stringify({
        currentState: "SCRIPT_REVIEWED",
        nextRecommendedCommand: "pnpm producer approve script --run <run_id>",
        runId: run.runId,
      }),
      "utf8",
    );

    const output = formatRunStatus(await readRunStatus(run.runId));

    expect(output).toContain(
      "Evidence: stale (evidence_bundle.json was generated for SCRIPT_REVIEWED, but the run is SCRIPT_APPROVED.)",
    );
    expect(output).toContain(`Evidence next action: pnpm producer evidence --run ${run.runId}`);
    expect(output).toContain(`Next safe action: pnpm producer evidence --run ${run.runId}`);
  });

  it("marks unreadable evidence JSON as invalid instead of missing", async () => {
    const run = await createRun();
    await mkdir(`runs/${run.runId}`, { recursive: true });
    await writeFile(artifactPath(run.runId, "evidence_bundle.json"), "{", "utf8");

    const output = formatRunStatus(await readRunStatus(run.runId));

    expect(output).toContain("Evidence: invalid (evidence_bundle.json could not be parsed.)");
    expect(output).toContain(`Evidence next action: pnpm producer evidence --run ${run.runId}`);
  });
});
