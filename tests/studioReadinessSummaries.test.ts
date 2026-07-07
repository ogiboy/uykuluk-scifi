import { mkdir, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { readStudioReadinessSnapshot } from "../apps/studio/src/lib/readinessSummaries";
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

  it("does not read readiness files through an invalid run id path", async () => {
    await mkdir("outside/diagnostics", { recursive: true });
    await writeFile(
      "outside/diagnostics/readiness.json",
      JSON.stringify({ checks: [], currentState: "NEW", passed: true, runId: "../outside" }),
      "utf8",
    );

    await expect(readStudioReadinessSnapshot(process.cwd(), "../outside")).resolves.toEqual({
      malformed: true,
      snapshot: null,
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

  it("treats blocking checks as not passed even when readiness says passed", async () => {
    const run = await createRun();
    await mkdir(`runs/${run.runId}/diagnostics`, { recursive: true });
    await writeFile(
      artifactPath(run.runId, "diagnostics/readiness.json"),
      JSON.stringify({
        checks: [
          {
            message: "costs/estimate.json is missing.",
            name: "budget not exceeded",
            nextAction: "pnpm producer estimate --run <run_id>",
            status: "block",
          },
        ],
        currentState: "NEW",
        passed: true,
        runId: run.runId,
      }),
      "utf8",
    );

    const [detail, summary] = await Promise.all([getStudioRunDetail(run.runId), listStudioRuns()]);

    expect(detail).toMatchObject({
      readinessChecks: [
        {
          message: "costs/estimate.json is missing.",
          name: "budget not exceeded",
          nextAction: `pnpm producer estimate --run ${run.runId}`,
          status: "block",
        },
      ],
      readinessMessage: "Readiness has not passed yet.",
      readinessPassed: false,
      readinessStatus: "blocked",
    });
    expect(summary[0]).toMatchObject({
      readinessMessage: "Readiness has not passed yet.",
      readinessPassed: false,
      readinessStatus: "blocked",
    });
  });
});
