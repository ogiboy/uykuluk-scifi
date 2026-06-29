import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildOperatorDeskViewModel, formatOperatorDeskPlain } from "../src/cli/operatorDeskModel";
import { createRun } from "../src/core/runStore";
import { useTempProject } from "./helpers";

const repoRoot = process.cwd();

describe("operator desk", () => {
  useTempProject();

  it("recommends idea generation when no runs exist", async () => {
    const model = await buildOperatorDeskViewModel();

    expect(model).toMatchObject({
      latestRunId: null,
      runDetails: [],
      runs: [],
      selectedRun: null,
    });
    expect(formatOperatorDeskPlain(model)).toContain("Next safe action: pnpm producer ideas");
  });

  it("shows the selected run and next safe action without mutating state", async () => {
    const first = await createRun();
    const second = await createRun();

    const model = await buildOperatorDeskViewModel({ runId: first.runId });

    expect(model.latestRunId).toBe(second.runId);
    expect(model.selectedRun).toMatchObject({
      evidenceStatus: "missing",
      nextRecommendedCommand: "pnpm producer ideas",
      readinessStatus: "missing",
      runId: first.runId,
      state: "NEW",
    });
    expect(model.runDetails.map((run) => run.runId)).toContain(first.runId);
    expect(formatOperatorDeskPlain(model)).toContain(`Selected run: ${first.runId}`);
  });

  it("prints a scriptable plain CLI summary", async () => {
    const run = await createRun();
    const result = spawnSync(
      path.join(repoRoot, "node_modules", ".bin", "tsx"),
      [path.join(repoRoot, "src", "cli.ts"), "desk", "--run", run.runId, "--plain"],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("UykulukSciFi Operator Desk");
    expect(result.stdout).toContain(`Selected run: ${run.runId}`);
    expect(result.stdout).toContain("Next safe action:");
  });

  it("rejects ambiguous run selection", async () => {
    const run = await createRun();

    await expect(buildOperatorDeskViewModel({ latest: true, runId: run.runId })).rejects.toThrow(
      "Use either --run or --latest, not both.",
    );
  });
});
