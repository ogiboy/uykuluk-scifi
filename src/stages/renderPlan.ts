import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { loadConfig } from "../config/config.js";
import { artifactPath, writeRunJson, writeRunText } from "../core/artifacts.js";
import { SafeExitError } from "../core/errors.js";
import { RunRecord, RunState } from "../core/state.js";
import { loadRun, saveRun } from "../core/runStore.js";
import { pathExists } from "../utils/fs.js";
import { readJsonFile } from "../utils/json.js";
import { nowIso } from "../utils/time.js";
import {
  productionPackageManifestPath,
  verifyProductionPackage,
} from "./productionPackageIntegrity.js";
import { renderContactSheet } from "./renderPlanContactSheet.js";
import { selectRenderAssets, uniqueAssets } from "./renderPlanAssets.js";
import {
  assetProvenanceSchema,
  AssetRef,
  productionSceneSchema,
  RenderPlan,
  renderPlanArtifactPaths,
  renderPlanSchema,
} from "./renderPlanSchemas.js";
import { ProductionScene } from "./types.js";

const renderPlanAllowedStates: ReadonlySet<RunState> = new Set([
  "PRODUCTION_PACKAGE_GENERATED",
  "COST_ESTIMATED",
  "PAID_GENERATION_COST_APPROVED",
  "READY_FOR_MANUAL_PRODUCTION",
]);

export type RenderPlanEvidence =
  | { status: "missing"; requiredArtifacts: readonly string[] }
  | { status: "pass"; path: string; digest: string; artifactCount: number; assetCount: number }
  | { status: "block"; path: string; message: string };

/**
 * Generates the render plan and related production artifacts for a run.
 *
 * @param runId - The run identifier.
 * @returns The generated render plan.
 */
export async function generateRenderPlan(runId: string): Promise<RenderPlan> {
  const config = await loadConfig();
  let run = await loadRun(runId);
  if (!renderPlanAllowedStates.has(run.state)) {
    throw new SafeExitError("Render planning requires a generated production package.");
  }
  const { digest } = await verifyProductionPackage(run);
  const scenes = await readProductionScenes(run.runId);
  const assets = await selectRenderAssets(config.assets);
  const now = nowIso();
  const plan = renderPlanSchema.parse({
    schemaVersion: 1,
    runId: run.runId,
    createdAt: now,
    productionPackageManifestPath,
    productionPackageManifestDigest: digest,
    format: {
      resolution: "1920x1080",
      fps: 30,
      aspectRatio: "16:9",
      draftRenderer: "ffmpeg-local-draft",
    },
    bookends: {
      intro: {
        durationSeconds: 2,
        asset: assets.introSource,
        ...(assets.introFrames.length > 0 ? { frameAssets: assets.introFrames } : {}),
      },
      outro: {
        durationSeconds: 3,
        asset: assets.outroSource,
        ...(assets.outroFrames.length > 0 ? { frameAssets: assets.outroFrames } : {}),
      },
    },
    scenes: scenes.map((scene, index) => ({
      sceneIndex: scene.index,
      narrationPreview: scene.narration.slice(0, 180),
      durationSeconds: scene.durationSeconds,
      visualPrompt: scene.visualPrompt,
      backgroundAsset: assets.backgrounds[index % assets.backgrounds.length],
      overlayAssets: [
        assets.subtitlePanel,
        assets.watermark,
        assets.lowerThird,
        assets.popupCard,
        assets.waveform,
      ].filter((asset): asset is AssetRef => Boolean(asset)),
      subtitleSource: "production/subtitles.srt",
      voiceoverSource: "production/voiceover.txt",
    })),
  });
  const provenance = assetProvenanceSchema.parse({
    schemaVersion: 1,
    runId: run.runId,
    createdAt: now,
    assets: uniqueAssets([
      assets.logo,
      assets.watermark,
      assets.subtitlePanel,
      assets.lowerThird,
      assets.popupCard,
      assets.introSource,
      ...assets.introFrames,
      assets.outroSource,
      ...assets.outroFrames,
      assets.factCheckIcon,
      assets.waveform,
      ...assets.backgrounds,
    ]),
  });

  run = await writeRunJson(run, "render-plan", "production/render_plan.json", plan);
  run = await writeRunText(
    run,
    "render-plan",
    "production/storyboard_contact_sheet.md",
    renderContactSheet(plan, provenance),
  );
  run = await writeRunJson(run, "render-plan", "production/asset_provenance.json", provenance);
  await saveRun(run);
  return plan;
}

export async function readRenderPlanEvidence(run: RunRecord): Promise<RenderPlanEvidence> {
  const registered = renderPlanArtifactPaths.some((relativePath) =>
    run.artifacts.includes(relativePath),
  );
  const exists = await Promise.all(
    renderPlanArtifactPaths.map((relativePath) =>
      pathExists(artifactPath(run.runId, relativePath)),
    ),
  );
  if (!registered && exists.every((item) => !item)) {
    return { status: "missing", requiredArtifacts: renderPlanArtifactPaths };
  }
  try {
    await assertRenderPlanArtifacts(run);
    const planText = await readFile(artifactPath(run.runId, "production/render_plan.json"), "utf8");
    renderPlanSchema.parse(JSON.parse(planText) as unknown);
    const provenance = assetProvenanceSchema.parse(
      await readJsonFile(artifactPath(run.runId, "production/asset_provenance.json")),
    );
    return {
      status: "pass",
      path: "production/render_plan.json",
      digest: createHash("sha256").update(planText, "utf8").digest("hex"),
      artifactCount: renderPlanArtifactPaths.length,
      assetCount: provenance.assets.length,
    };
  } catch (error) {
    return {
      status: "block",
      path: "production/render_plan.json",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

async function readProductionScenes(runId: string): Promise<ProductionScene[]> {
  const data = await readJsonFile<{ scenes: unknown[] }>(
    artifactPath(runId, "production/scenes.json"),
  );
  const scenes = z.array(productionSceneSchema).min(1).parse(data.scenes);
  return scenes.map((scene) => ({ ...scene }));
}

async function assertRenderPlanArtifacts(run: RunRecord): Promise<void> {
  for (const relativePath of renderPlanArtifactPaths) {
    if (!run.artifacts.includes(relativePath)) {
      throw new SafeExitError(`Render plan artifact is not registered: ${relativePath}.`);
    }
    if (!(await pathExists(artifactPath(run.runId, relativePath)))) {
      throw new SafeExitError(`Render plan artifact is missing: ${relativePath}.`);
    }
  }
}
