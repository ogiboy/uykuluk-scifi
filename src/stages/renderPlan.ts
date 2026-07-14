import { z } from "zod";
import { loadConfig } from "../config/config.js";
import { artifactPath, writeRunJson, writeRunText } from "../core/artifacts.js";
import { SafeExitError } from "../core/errors.js";
import { loadRun, saveRun } from "../core/runStore.js";
import { RunState } from "../core/state.js";
import { readJsonFile } from "../utils/json.js";
import { nowIso } from "../utils/time.js";
import {
  productionPackageManifestPath,
  verifyProductionPackage,
} from "./production/productionPackageIntegrity.js";
import { readProductionPackagePopupCards } from "./production/productionPackageMarkdown.js";
import { selectRenderAssets, uniqueAssets } from "./render/renderPlanAssets.js";
import { renderContactSheet } from "./render/renderPlanContactSheet.js";
import {
  assetProvenanceSchema,
  AssetRef,
  productionSceneSchema,
  RenderPlan,
  renderPlanSchema,
} from "./render/renderPlanSchemas.js";
import { ProductionScene } from "./types.js";
import { readApprovedVisualManifestEvidence } from "./visuals/visualManifest.js";

export {
  readRenderPlanEvidence,
  readRenderPlanEvidenceAtProjectRoot,
} from "./render/renderPlanEvidence.js";
export type { RenderPlanEvidence } from "./render/renderPlanEvidence.js";

const renderPlanAllowedStates: ReadonlySet<RunState> = new Set([
  "PRODUCTION_PACKAGE_GENERATED",
  "COST_ESTIMATED",
  "PAID_GENERATION_COST_APPROVED",
  "READY_FOR_MANUAL_PRODUCTION",
]);

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
  const visualEvidence = await readApprovedVisualManifestEvidence(run);
  if (visualEvidence.status !== "pass") {
    throw new SafeExitError(
      visualEvidence.status === "missing"
        ? "Render planning requires prepared and approved scene visuals."
        : `Render planning requires approved scene visuals: ${visualEvidence.message}`,
    );
  }
  const scenes = await readProductionScenes(run.runId);
  const popupCards = await readProductionPackagePopupCards(run.runId);
  const assets = await selectRenderAssets(config.assets);
  const now = nowIso();
  const plan = renderPlanSchema.parse({
    schemaVersion: 2,
    runId: run.runId,
    createdAt: now,
    productionPackageManifestPath,
    productionPackageManifestDigest: digest,
    visualManifest: { path: visualEvidence.path, digest: visualEvidence.digest },
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
    scenes: visualEvidence.manifest.scenes.map((visualScene, index) => {
      const visualRevision = visualScene.revisions.find(
        (item) => item.revision === visualScene.activeRevision,
      );
      if (!visualRevision) {
        throw new SafeExitError(
          `Approved visual evidence is missing beat ${visualScene.sceneIndex}.`,
        );
      }
      const sourceScenes = visualScene.productionSceneIndexes.map((sceneIndex) => {
        const source = scenes.find((scene) => scene.index === sceneIndex);
        if (!source) {
          throw new SafeExitError(
            `Approved visual beat ${visualScene.sceneIndex} references missing production scene ${sceneIndex}.`,
          );
        }
        return source;
      });
      return {
        sceneIndex: visualScene.sceneIndex,
        narrationPreview: sourceScenes
          .map((scene) => scene.narration)
          .join(" ")
          .slice(0, 180),
        durationSeconds: visualScene.durationSeconds,
        visualPrompt: visualScene.visualPrompt,
        ...popupCardText(popupCards, index),
        backgroundAsset: visualRevision.asset,
        visualRevision: visualRevision.revision,
        motion: visualRevision.motion,
        overlayAssets: [
          assets.subtitlePanel,
          assets.watermark,
          assets.lowerThird,
          assets.popupCard,
          assets.waveform,
        ].filter((asset): asset is AssetRef => Boolean(asset)),
        subtitleSource: "production/subtitles.srt" as const,
        voiceoverSource: "production/voiceover.txt" as const,
      };
    }),
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
      ...visualEvidence.manifest.scenes
        .map((scene) => scene.revisions.find((item) => item.revision === scene.activeRevision))
        .map((revision) => revision?.asset),
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

function popupCardText(cards: readonly string[], sceneIndex: number): { popupCardText?: string } {
  if (cards.length === 0) {
    return {};
  }
  return { popupCardText: cards[sceneIndex % cards.length] };
}

async function readProductionScenes(runId: string): Promise<ProductionScene[]> {
  const data = await readJsonFile<{ scenes: unknown[] }>(
    artifactPath(runId, "production/scenes.json"),
  );
  const scenes = z.array(productionSceneSchema).min(1).parse(data.scenes);
  return scenes.map((scene) => ({ ...scene }));
}
