import { spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { artifactPath } from "../src/core/artifacts";
import { createRun } from "../src/core/runStore";
import { formatRenderPlanReviewConsole, reviewRenderPlan } from "../src/stages/reviewRenderPlan";
import { readJsonFile } from "../src/utils/json";
import { useTempProject } from "./helpers";
import { prepareReadyRunWithoutVoiceover } from "./renderPipelineHelpers";

const repoRoot = process.cwd();

describe("render-plan operator review", () => {
  useTempProject();

  it("reads a validated render-plan and contact-sheet handoff", async () => {
    const runId = await prepareReadyRunWithoutVoiceover();

    const handoff = await reviewRenderPlan(runId);

    expect(handoff).toMatchObject({
      assetCount: expect.any(Number),
      assetProvenancePath: "production/asset_provenance.json",
      contactSheetPath: "production/storyboard_contact_sheet.md",
      format: {
        aspectRatio: "16:9",
        draftRenderer: "ffmpeg-local-draft",
        fps: 30,
        resolution: "1920x1080",
      },
      renderPlanPath: "production/render_plan.json",
      runId,
      sceneCount: expect.any(Number),
    });
    expect(handoff.estimatedDraftDurationSeconds).toBeGreaterThan(0);
    expect(handoff.nextSafeAction).toContain(`pnpm producer estimate --run ${runId}`);
    expect(handoff.blockedActions).toEqual(
      expect.arrayContaining([
        expect.stringContaining("paid/generative media providers remain disabled"),
      ]),
    );
    expect(formatRenderPlanReviewConsole(handoff)).toContain("Contact sheet:");
  });

  it("prints a CLI review handoff for render plans", async () => {
    const runId = await prepareReadyRunWithoutVoiceover();

    const jsonResult = runCli(["review", "render-plan", "--run", runId, "--json"]);
    const consoleResult = runCli(["review", "render-plan", "--run", runId]);

    expect(jsonResult.status).toBe(0);
    expect(JSON.parse(jsonResult.stdout) as unknown).toMatchObject({
      contactSheetPath: "production/storyboard_contact_sheet.md",
      nextSafeAction: expect.stringContaining(`pnpm producer estimate --run ${runId}`),
      runId,
    });
    expect(consoleResult.status).toBe(0);
    expect(consoleResult.stdout).toContain("Render plan: production/render_plan.json");
    expect(consoleResult.stdout).toContain("Still blocked:");
  });

  it("fails closed when render-plan artifacts are missing or stale", async () => {
    const run = await createRun();
    await expect(reviewRenderPlan(run.runId)).rejects.toThrow(
      `Run pnpm producer render-plan --run ${run.runId}`,
    );

    const runId = await prepareReadyRunWithoutVoiceover();
    const planPath = artifactPath(runId, "production/render_plan.json");
    const plan = await readJsonFile<Record<string, unknown>>(planPath);
    await writeFile(
      planPath,
      JSON.stringify({ ...plan, productionPackageManifestDigest: "0".repeat(64) }),
      "utf8",
    );

    await expect(reviewRenderPlan(runId)).rejects.toThrow(/stale production package manifest/i);
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
