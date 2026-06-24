import { mkdir } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { artifactPath } from "../src/core/artifacts";
import { ledgerPath } from "../src/core/ledger";
import { createRun, listRuns, runDir, statePath } from "../src/core/runStore";
import { costLedgerPath, readAllCostEvents } from "../src/costs/costLedger";
import {
  costReservationLedgerPath,
  readAllCostReservationSummaries,
} from "../src/costs/costReservationStore";
import { useTempProject } from "./helpers";

const repoRoot = process.cwd();
const windowsPathSeparator = String.fromCodePoint(92);
const posixPathSeparator = String.fromCodePoint(47);
const parentPathSegment = [".."].join("");

describe("run id validation", () => {
  useTempProject();

  it.each([
    "",
    "run_",
    ".",
    "..",
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
    const result = spawnSync(
      path.join(repoRoot, "node_modules", ".bin", "tsx"),
      [path.join(repoRoot, "src", "cli.ts"), "status", "--run", unsafeRunId],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toMatch(/invalid run id/i);
  });
});

function posixAbsolutePath(...segments: string[]): string {
  return `${posixPathSeparator}${segments.join(posixPathSeparator)}`;
}

function windowsRelativePath(...segments: string[]): string {
  return segments.join(windowsPathSeparator);
}

function pathSegments(...segments: string[]): string {
  return segments.join(posixPathSeparator);
}
