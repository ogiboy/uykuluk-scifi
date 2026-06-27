import { mkdir, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { artifactPath } from "../src/core/artifacts";
import { createRun } from "../src/core/runStore";
import { formatRunStatus, readRunStatus } from "../src/stages/status";
import { useTempProject } from "./helpers";

describe("status readiness summary", () => {
  useTempProject();

  it("shows blocked and warning readiness checks with materialized next actions", async () => {
    const run = await createRun();
    await mkdir(`runs/${run.runId}/diagnostics`, { recursive: true });
    await writeFile(
      artifactPath(run.runId, "diagnostics/readiness.json"),
      JSON.stringify({
        checks: [
          {
            message: "Render plan exists.",
            name: "render plan available",
            status: "pass",
          },
          {
            message: "Voiceover audio is not generated yet.",
            name: "voiceover audio available",
            nextAction: "pnpm producer voice --run <run_id>",
            status: "warn",
          },
          {
            message: "costs/estimate.json is missing.",
            name: "budget not exceeded",
            nextAction: "pnpm producer estimate --run <run_id>",
            status: "block",
          },
        ],
        currentState: "NEW",
        passed: false,
        runId: run.runId,
      }),
      "utf8",
    );

    const output = formatRunStatus(await readRunStatus(run.runId));

    expect(output).toContain("Readiness: blocked (3 checks, 1 block, 1 warn)");
    expect(output).toContain("Readiness attention:");
    expect(output).toContain(
      "- voiceover audio available [warn]: Voiceover audio is not generated yet.",
    );
    expect(output).toContain(`  Next action: pnpm producer voice --run ${run.runId}`);
    expect(output).toContain("- budget not exceeded [block]: costs/estimate.json is missing.");
    expect(output).toContain(`  Next action: pnpm producer estimate --run ${run.runId}`);
  });

  it("marks readiness as not generated when the diagnostic artifact is missing", async () => {
    const run = await createRun();

    const output = formatRunStatus(await readRunStatus(run.runId));

    expect(output).toContain("Readiness: not generated");
    expect(output).toContain(`Readiness next action: pnpm producer readiness --run ${run.runId}`);
  });

  it("marks malformed readiness checks as invalid instead of ignoring them", async () => {
    const run = await createRun();
    await mkdir(`runs/${run.runId}/diagnostics`, { recursive: true });
    await writeFile(
      artifactPath(run.runId, "diagnostics/readiness.json"),
      JSON.stringify({
        checks: [{ name: "budget not exceeded", status: "block" }],
        currentState: "NEW",
        passed: true,
        runId: run.runId,
      }),
      "utf8",
    );

    const output = formatRunStatus(await readRunStatus(run.runId));

    expect(output).toContain(
      "Readiness: invalid (diagnostics/readiness.json contains an invalid check.)",
    );
    expect(output).toContain(`Readiness next action: pnpm producer readiness --run ${run.runId}`);
  });

  it("marks readiness generated for a previous run state as stale", async () => {
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

    const output = formatRunStatus(await readRunStatus(run.runId));

    expect(output).toContain(
      "Readiness: stale (diagnostics/readiness.json was generated for SCRIPT_APPROVED, but the run is NEW.)",
    );
    expect(output).toContain(`Readiness next action: pnpm producer readiness --run ${run.runId}`);
  });
});
