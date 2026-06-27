import { mkdir, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { getStudioRunDetail, listStudioRuns } from "../apps/studio/src/lib/runSummaries";
import { artifactPath } from "../src/core/artifacts";
import { createRun } from "../src/core/runStore";
import { useTempProject } from "./helpers";

describe("Studio readiness summary validity", () => {
  useTempProject();

  it("marks readiness generated for an older run state as stale", async () => {
    const run = await createRun();
    await mkdir(`runs/${run.runId}/diagnostics`, { recursive: true });
    await writeFile(
      artifactPath(run.runId, "diagnostics/readiness.json"),
      JSON.stringify({
        checks: [{ message: "Config exists.", name: "project config exists", status: "pass" }],
        currentState: "SCRIPT_APPROVED",
        passed: true,
        runId: run.runId,
      }),
      "utf8",
    );

    const detail = await getStudioRunDetail(run.runId);

    expect(detail).toMatchObject({
      readinessChecks: [],
      readinessMessage:
        "Readiness diagnostics were generated for SCRIPT_APPROVED, but the run is NEW.",
      readinessNextAction: `pnpm producer readiness --run ${run.runId}`,
      readinessPassed: null,
      readinessStatus: "stale",
    });
  });

  it("marks malformed readiness checks as invalid instead of dropping them", async () => {
    const run = await createRun();
    await mkdir(`runs/${run.runId}/diagnostics`, { recursive: true });
    await writeFile(
      artifactPath(run.runId, "diagnostics/readiness.json"),
      JSON.stringify({
        checks: [{ name: "budget not exceeded", status: "block" }],
        currentState: "NEW",
        passed: false,
        runId: run.runId,
      }),
      "utf8",
    );

    const detail = await getStudioRunDetail(run.runId);

    expect(detail).toMatchObject({
      readinessChecks: [],
      readinessMessage: "Readiness diagnostics contain an invalid check.",
      readinessNextAction: `pnpm producer readiness --run ${run.runId}`,
      readinessPassed: null,
      readinessStatus: "invalid",
    });
  });

  it("marks unreadable readiness JSON as invalid instead of missing", async () => {
    const run = await createRun();
    await mkdir(`runs/${run.runId}/diagnostics`, { recursive: true });
    await writeFile(artifactPath(run.runId, "diagnostics/readiness.json"), "{", "utf8");

    const detail = await getStudioRunDetail(run.runId);

    expect(detail).toMatchObject({
      readinessChecks: [],
      readinessMessage: "Readiness diagnostics could not be parsed.",
      readinessNextAction: `pnpm producer readiness --run ${run.runId}`,
      readinessPassed: null,
      readinessStatus: "invalid",
    });
  });

  it("surfaces stale readiness status in run index summaries", async () => {
    const run = await createRun();
    await mkdir(`runs/${run.runId}/diagnostics`, { recursive: true });
    await writeFile(
      artifactPath(run.runId, "diagnostics/readiness.json"),
      JSON.stringify({
        checks: [{ message: "Config exists.", name: "project config exists", status: "pass" }],
        currentState: "SCRIPT_APPROVED",
        passed: true,
        runId: run.runId,
      }),
      "utf8",
    );

    const summaries = await listStudioRuns();

    expect(summaries[0]).toMatchObject({
      readinessMessage:
        "Readiness diagnostics were generated for SCRIPT_APPROVED, but the run is NEW.",
      readinessNextAction: `pnpm producer readiness --run ${run.runId}`,
      readinessPassed: null,
      readinessStatus: "stale",
    });
  });
});
