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
      assetRoleCounts: expect.arrayContaining([
        expect.objectContaining({ count: expect.any(Number), value: "watermark" }),
      ]),
      assetProvenancePath: "production/asset_provenance.json",
      backgroundReuse: expect.arrayContaining([
        expect.objectContaining({
          count: expect.any(Number),
          value: expect.stringContaining("assets/backgrounds/"),
        }),
      ]),
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
      sceneAssetMap: expect.arrayContaining([
        expect.objectContaining({
          backgroundAssetPath: expect.stringContaining("assets/backgrounds/"),
          durationSeconds: expect.any(Number),
          overlayAssetPaths: expect.arrayContaining([
            "assets/overlays/subtitle_panel_blank_1700x190.png",
          ]),
          sceneIndex: expect.any(Number),
        }),
      ]),
      timing: {
        averageSceneDurationSeconds: expect.any(Number),
        bookendDurationSeconds: expect.any(Number),
        estimatedDraftDurationSeconds: expect.any(Number),
        longestSceneDurationSeconds: expect.any(Number),
        sceneDurationSeconds: expect.any(Number),
        shortestSceneDurationSeconds: expect.any(Number),
      },
    });
    expect(handoff.estimatedDraftDurationSeconds).toBeGreaterThan(0);
    expect(handoff.nextSafeAction).toContain(`pnpm producer estimate --run ${runId}`);
    expect(handoff.reviewChecklist).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Confirm subtitle panel, popup card, waveform, and watermark"),
      ]),
    );
    expect(handoff.revisionGuidance).toEqual(
      expect.arrayContaining([expect.stringContaining("regenerate the render plan")]),
    );
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
      reviewChecklist: expect.arrayContaining([
        expect.stringContaining("Review"),
        expect.stringContaining("does not approve voiceover"),
      ]),
      runId,
    });
    expect(consoleResult.status).toBe(0);
    expect(consoleResult.stdout).toContain("Render plan: production/render_plan.json");
    expect(consoleResult.stdout).toContain("Scene duration range:");
    expect(consoleResult.stdout).toContain("Background reuse:");
    expect(consoleResult.stdout).toContain("Scene asset map:");
    expect(consoleResult.stdout).toContain("assets/overlays/subtitle_panel_blank_1700x190.png");
    expect(consoleResult.stdout).toContain("Review checklist:");
    expect(consoleResult.stdout).toContain("Revision guidance:");
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
