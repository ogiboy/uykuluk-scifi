import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { artifactPath } from "../src/core/artifacts";
import { loadRun } from "../src/core/runStore";
import { approveIdea } from "../src/stages/approveIdea";
import { approveScript } from "../src/stages/approveScript";
import { runIdeas } from "../src/stages/ideas";
import { generateProductionPackage } from "../src/stages/productionPackage";
import { reviewScript } from "../src/stages/reviewScript";
import { generateScript } from "../src/stages/script";
import { pathExists } from "../src/utils/fs";
import { useTempProject } from "./helpers";

const repoRoot = process.cwd();

describe("producer render-plan CLI", () => {
  useTempProject();

  it("prints parseable JSON render plans for automation", async () => {
    await createMinimalRenderAssets();
    const runId = await preparePackagedRun();

    const result = runCli(["render-plan", "--run", runId, "--json"]);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout) as unknown).toMatchObject({
      schemaVersion: 1,
      runId,
      productionPackageManifestPath: "production/production_package.meta.json",
      scenes: expect.arrayContaining([
        expect.objectContaining({
          backgroundAsset: expect.objectContaining({
            path: "assets/backgrounds/plate_test_1920x1080.jpg",
          }),
        }),
      ]),
    });
    expect(await loadRun(runId)).toMatchObject({ state: "PRODUCTION_PACKAGE_GENERATED" });
    await expect(pathExists(artifactPath(runId, "production/render_plan.json"))).resolves.toBe(
      true,
    );
  });

  it("prints the read-only review command after generating a render plan", async () => {
    await createMinimalRenderAssets();
    const runId = await preparePackagedRun();

    const result = runCli(["render-plan", "--run", runId]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Render plan generated.");
    expect(result.stdout).toContain("Contact sheet: production/storyboard_contact_sheet.md");
    expect(result.stdout).toContain("Asset provenance: production/asset_provenance.json");
    expect(result.stdout).toContain(
      `Next safe action: pnpm producer review render-plan --run ${runId}`,
    );
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

async function preparePackagedRun(): Promise<string> {
  const { runId, ideas } = await runIdeas();
  await approveIdea(runId, ideas[0].id);
  await generateScript(runId);
  await reviewScript(runId);
  await approveScript(runId, { acknowledgeWarnings: true });
  await generateProductionPackage(runId);
  return runId;
}

async function createMinimalRenderAssets(): Promise<void> {
  const files = new Map([
    ["assets/brand/uykulukscifi_channel_logo_square_1024.png", "logo"],
    ["assets/brand/uykulukscifi_watermark_transparent_500.png", "watermark"],
    ["assets/overlays/subtitle_panel_blank_1700x190.png", "subtitle panel"],
    ["assets/overlays/video_lower_third_banner_1920x240.png", "lower third"],
    ["assets/overlays/popup_info_card_900x520.png", "popup card"],
    ["assets/intro/episode_title_card_1920x1080.jpg", "intro"],
    ["assets/intro/frames/intro_frame_00.jpg", "intro frame 0"],
    ["assets/intro/frames/intro_frame_01.jpg", "intro frame 1"],
    ["assets/outro/youtube_end_screen_1920x1080.jpg", "outro"],
    ["assets/outro/frames/outro_frame_00.jpg", "outro frame 0"],
    ["assets/outro/frames/outro_frame_01.jpg", "outro frame 1"],
    ["assets/backgrounds/plate_test_1920x1080.jpg", "background"],
    ["assets/icons/icon_fact_check_512.png", "fact icon"],
    ["assets/waveforms/waveform_overlay_thin_panel_transparent_1920x240.png", "waveform"],
  ]);
  for (const [target, content] of files) {
    await mkdir(target.split("/").slice(0, -1).join("/"), { recursive: true });
    await writeFile(target, content, "utf8");
  }
}
