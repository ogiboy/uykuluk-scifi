import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { artifactPath } from "../src/core/artifacts";
import { createRun, saveRun } from "../src/core/runStore";
import { useTempProject } from "./helpers";

const repoRoot = process.cwd();

describe("producer status CLI", () => {
  useTempProject();

  it("preserves raw persisted state JSON for automation", async () => {
    const run = await createRun();
    const result = runCli(["status", "--run", run.runId, "--json"]);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout) as unknown).toMatchObject({
      runId: run.runId,
      state: "NEW",
    });
  });

  it("prints parseable operator summary JSON for automation", async () => {
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
        passed: false,
        runId: run.runId,
      }),
      "utf8",
    );
    await saveRun({
      ...run,
      artifacts: ["diagnostics/readiness.json"],
    });

    const result = runCli(["status", "--run", run.runId, "--summary-json"]);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout) as unknown).toMatchObject({
      evidenceStatus: "missing",
      nextRecommendedCommand: "pnpm producer ideas",
      readiness: {
        attention: [
          {
            name: "budget not exceeded",
            nextAction: `pnpm producer estimate --run ${run.runId}`,
            status: "block",
          },
        ],
        status: "blocked",
      },
      run: {
        runId: run.runId,
        state: "NEW",
      },
    });
  });

  it("rejects ambiguous status JSON modes", async () => {
    const run = await createRun();
    const result = runCli(["status", "--run", run.runId, "--json", "--summary-json"]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Use either --json or --summary-json, not both.");
  });
});

function runCli(args: string[]): { status: number | null; stderr: string; stdout: string } {
  const result = spawnSync(
    path.join(repoRoot, "node_modules", ".bin", "tsx"),
    [path.join(repoRoot, "src", "cli.ts"), ...args],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  return {
    status: result.status,
    stderr: result.stderr.toString(),
    stdout: result.stdout.toString(),
  };
}
