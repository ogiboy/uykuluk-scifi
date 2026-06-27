import { mkdir, readFile, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { artifactPath } from "../src/core/artifacts";
import { loadRun } from "../src/core/runStore";
import { approveIdea } from "../src/stages/approveIdea";
import { approveScript } from "../src/stages/approveScript";
import { generateEvidenceBundle } from "../src/stages/evidence";
import { estimateCost } from "../src/stages/estimate";
import { runIdeas } from "../src/stages/ideas";
import { generateProductionPackage } from "../src/stages/productionPackage";
import { generateRenderPlan } from "../src/stages/renderPlan";
import { runReadiness } from "../src/stages/readiness";
import { reviewScript } from "../src/stages/reviewScript";
import { generateScript } from "../src/stages/script";
import { pathExists } from "../src/utils/fs";
import { readJsonFile } from "../src/utils/json";
import { useTempProject } from "./helpers";

const renderArtifacts = [
  "production/render_plan.json",
  "production/storyboard_contact_sheet.md",
  "production/asset_provenance.json",
] as const;

describe("render plan", () => {
  useTempProject();

  it("generates a deterministic render plan, contact sheet, and asset provenance", async () => {
    await createMinimalRenderAssets();
    const runId = await preparePackagedRun();

    await generateRenderPlan(runId);

    const run = await loadRun(runId);
    expect(run.state).toBe("PRODUCTION_PACKAGE_GENERATED");
    for (const artifact of renderArtifacts) {
      expect(run.artifacts).toContain(artifact);
      expect(await pathExists(artifactPath(runId, artifact))).toBe(true);
    }

    const plan = await readJsonFile<{
      schemaVersion: number;
      runId: string;
      productionPackageManifestPath: string;
      bookends: {
        intro: {
          durationSeconds: number;
          asset: { path: string; digest: string };
          frameAssets?: Array<{ path: string; digest: string }>;
        };
        outro: {
          durationSeconds: number;
          asset: { path: string; digest: string };
          frameAssets?: Array<{ path: string; digest: string }>;
        };
      };
      scenes: Array<{
        sceneIndex: number;
        backgroundAsset: { path: string; digest: string };
        overlayAssets: Array<{ role: string; path: string; digest: string }>;
      }>;
    }>(artifactPath(runId, "production/render_plan.json"));
    expect(plan).toMatchObject({
      schemaVersion: 1,
      runId,
      productionPackageManifestPath: "production/production_package.meta.json",
    });
    expect(plan.bookends).toMatchObject({
      intro: {
        durationSeconds: 2,
        asset: { path: "assets/intro/episode_title_card_1920x1080.jpg" },
        frameAssets: [
          { path: "assets/intro/frames/intro_frame_00.jpg" },
          { path: "assets/intro/frames/intro_frame_01.jpg" },
        ],
      },
      outro: {
        durationSeconds: 3,
        asset: { path: "assets/outro/youtube_end_screen_1920x1080.jpg" },
        frameAssets: [
          { path: "assets/outro/frames/outro_frame_00.jpg" },
          { path: "assets/outro/frames/outro_frame_01.jpg" },
        ],
      },
    });
    expect(plan.scenes.length).toBeGreaterThan(0);
    expect(plan.scenes[0].backgroundAsset).toMatchObject({
      path: "assets/backgrounds/plate_test_1920x1080.jpg",
      digest: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(plan.scenes[0].overlayAssets.map((asset) => asset.role)).toEqual(
      expect.arrayContaining(["subtitle-panel", "watermark", "popup-card", "waveform-overlay"]),
    );

    const provenance = await readJsonFile<{
      assets: Array<{ role: string; path: string; digest: string }>;
    }>(artifactPath(runId, "production/asset_provenance.json"));
    expect(provenance.assets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: "watermark" }),
        expect.objectContaining({ role: "subtitle-panel" }),
        expect.objectContaining({ role: "background-plate" }),
        expect.objectContaining({ role: "intro-source" }),
        expect.objectContaining({ role: "intro-source-frame" }),
        expect.objectContaining({ role: "outro-source" }),
        expect.objectContaining({ role: "outro-source-frame" }),
      ]),
    );
    const contactSheet = await readFile(
      artifactPath(runId, "production/storyboard_contact_sheet.md"),
      "utf8",
    );
    expect(contactSheet).toContain("## Intro And Outro Bookends");
    expect(contactSheet).toContain("assets/intro/episode_title_card_1920x1080.jpg");
    expect(contactSheet).toContain("Intro source frames: 2 committed frames");
    expect(contactSheet).toContain("assets/outro/youtube_end_screen_1920x1080.jpg");
    expect(contactSheet).toContain("Outro source frames: 2 committed frames");
    expect(contactSheet).toContain("## Operator Decision");
    expect(contactSheet).toContain(`pnpm producer readiness --run ${runId}`);
    expect(contactSheet).toContain(`pnpm producer voice --run ${runId}`);
    expect(contactSheet).toContain(
      "file existence does not approve TTS, render, upload, or publish",
    );
    expect(contactSheet).toContain("public publish");

    await estimateCost(runId);
    const evidence = (await generateEvidenceBundle(runId)) as {
      renderPlan: { status: string; artifactCount: number; assetCount: number };
    };
    expect(evidence.renderPlan).toMatchObject({
      status: "pass",
      artifactCount: 3,
      assetCount: provenance.assets.length,
    });

    const readiness = await runReadiness(runId);
    expect(readiness.checks.find((check) => check.name === "render plan available")).toMatchObject({
      status: "pass",
      message: expect.stringMatching(/render_plan\.json/i),
    });
  });

  it("blocks before a production package exists", async () => {
    const { runId, ideas } = await runIdeas();
    await approveIdea(runId, ideas[0].id);
    await generateScript(runId);

    await expect(generateRenderPlan(runId)).rejects.toThrow(/production package/i);
    for (const artifact of renderArtifacts) {
      expect(await pathExists(artifactPath(runId, artifact))).toBe(false);
    }
  });

  it("blocks when required render assets are missing", async () => {
    const runId = await preparePackagedRun();

    await expect(generateRenderPlan(runId)).rejects.toThrow(/missing render planning asset/i);
    for (const artifact of renderArtifacts) {
      expect(await pathExists(artifactPath(runId, artifact))).toBe(false);
    }
  });
});

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
