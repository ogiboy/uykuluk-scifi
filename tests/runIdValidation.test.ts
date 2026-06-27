import { mkdir } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { artifactPath } from "../src/core/artifacts";
import { ledgerPath } from "../src/core/ledger";
import { createRun, listRuns, runDir, saveRun, statePath } from "../src/core/runStore";
import { costLedgerPath, readAllCostEvents } from "../src/costs/costLedger";
import {
  costReservationLedgerPath,
  readAllCostReservationSummaries,
} from "../src/costs/costReservationStore";
import { useTempProject } from "./helpers";

const repoRoot = process.cwd();
const windowsPathSeparator = String.fromCodePoint(92);
const posixPathSeparator = String.fromCodePoint(47);
const currentPathSegment = ["."].join("");
const parentPathSegment = [".."].join("");

describe("run id validation", () => {
  useTempProject();

  it.each([
    "",
    "run_",
    currentPathSegment,
    parentPathSegment,
    pathSegments(parentPathSegment, "outside"),
    pathSegments("run_", parentPathSegment, parentPathSegment, "outside"),
    pathSegments("run_valid", "child"),
    windowsRelativePath("run_valid", "child"),
    posixAbsolutePath("outside", "run_valid"),
    " run_valid",
    "run_valid ",
    "run_valid\n",
    "run_valid\r",
    "other_20260619053334_pkt3z1",
    `run_${"a".repeat(125)}`,
  ])("rejects unsafe run id %j before constructing a path", (runId) => {
    expect(() => runDir(runId)).toThrow(/invalid run id/i);
    expect(() => statePath(runId)).toThrow(/invalid run id/i);
  });

  it("preserves the generated run id format", () => {
    const runId = "run_20260619053334_pkt3z1";

    expect(runDir(runId)).toBe(path.join(process.cwd(), "runs", runId));
  });

  it("applies the same validation to every run-root filesystem helper", () => {
    const unsafeRunId = pathSegments(parentPathSegment, "outside");

    for (const buildPath of [
      () => artifactPath(unsafeRunId, "script.md"),
      () => ledgerPath(unsafeRunId),
      () => costLedgerPath(unsafeRunId),
      () => costReservationLedgerPath(unsafeRunId),
    ]) {
      expect(buildPath).toThrow(/invalid run id/i);
    }
  });

  it("ignores unrelated directories while listing valid runs", async () => {
    const run = await createRun();
    await mkdir(path.join("runs", "not-a-run"), { recursive: true });

    await expect(listRuns()).resolves.toEqual([
      expect.objectContaining({ runId: run.runId, state: "NEW" }),
    ]);
    await expect(readAllCostEvents()).resolves.toEqual([]);
    await expect(readAllCostReservationSummaries()).resolves.toEqual([]);
  });

  it("makes the CLI reject a traversal-shaped run id", () => {
    const unsafeRunId = pathSegments(parentPathSegment, "outside");
    const result = runCli(["status", "--run", unsafeRunId]);

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toMatch(/invalid run id/i);
  });

  it("makes the CLI status command require exactly one run selector", async () => {
    const run = await createRun();

    const missing = runCli(["status"]);
    const duplicate = runCli(["status", "--run", run.runId, "--latest"]);

    expect(missing.status).not.toBe(0);
    expect(`${missing.stdout}${missing.stderr}`).toContain("Provide --run <run_id> or --latest.");
    expect(duplicate.status).not.toBe(0);
    expect(`${duplicate.stdout}${duplicate.stderr}`).toContain(
      "Use either --run <run_id> or --latest, not both.",
    );
  });

  it("makes the CLI status command select the latest run when requested", async () => {
    const older = await createRun();
    await saveRun({ ...older, createdAt: "2026-06-01T00:00:00.000Z" });
    const latest = await createRun();
    await saveRun({ ...latest, createdAt: "2026-06-02T00:00:00.000Z" });

    const result = runCli(["status", "--latest", "--json"]);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout) as unknown).toMatchObject({ runId: latest.runId });
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

function posixAbsolutePath(...segments: string[]): string {
  return `${posixPathSeparator}${segments.join(posixPathSeparator)}`;
}

function windowsRelativePath(...segments: string[]): string {
  return segments.join(windowsPathSeparator);
}

function pathSegments(...segments: string[]): string {
  return segments.join(posixPathSeparator);
}
