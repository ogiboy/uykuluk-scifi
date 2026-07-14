import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { loadConfig } from "../config/config.js";
import { artifactPathAtProjectRoot } from "../core/artifactPaths.js";
import { artifactPath, writeRunJson, writeRunText } from "../core/artifacts.js";
import { SafeExitError } from "../core/errors.js";
import { loadRun, saveRun } from "../core/runStore.js";
import { RunRecord, RunState } from "../core/state.js";
import { pathExists } from "../utils/fs.js";
import { readJsonFile } from "../utils/json.js";
import { nowIso } from "../utils/time.js";
import {
  productionPackageManifestPath,
  verifyProductionPackage,
  verifyProductionPackageAtProjectRoot,
} from "./production/productionPackageIntegrity.js";
import { readProductionPackagePopupCards } from "./production/productionPackageMarkdown.js";
import { selectRenderAssets, uniqueAssets } from "./render/renderPlanAssets.js";
import { renderContactSheet } from "./render/renderPlanContactSheet.js";
import {
  AssetProvenance,
  assetProvenanceSchema,
  AssetRef,
  productionSceneSchema,
  RenderPlan,
  renderPlanArtifactPaths,
  renderPlanSchema,
} from "./render/renderPlanSchemas.js";
import { ProductionScene } from "./types.js";
import { readApprovedVisualManifestEvidence } from "./visuals/visualManifest.js";

const renderPlanAllowedStates: ReadonlySet<RunState> = new Set([
  "PRODUCTION_PACKAGE_GENERATED",
  "COST_ESTIMATED",
  "PAID_GENERATION_COST_APPROVED",
  "READY_FOR_MANUAL_PRODUCTION",
]);

export type RenderPlanEvidence =
  | { status: "missing"; requiredArtifacts: readonly string[] }
  | {
      status: "pass";
      path: string;
      digest: string;
      artifactCount: number;
      assetCount: number;
      visualManifestDigest?: string;
    }
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

export async function readRenderPlanEvidence(run: RunRecord): Promise<RenderPlanEvidence> {
  return readRenderPlanEvidenceAtProjectRoot(process.cwd(), run);
}

/** Reads render-plan evidence beneath an explicit producer project root. */
export async function readRenderPlanEvidenceAtProjectRoot(
  projectRoot: string,
  run: RunRecord,
): Promise<RenderPlanEvidence> {
  const resolveArtifact = (relativePath: string) =>
    artifactPathAtProjectRoot(projectRoot, run.runId, relativePath);
  const registered = renderPlanArtifactPaths.some((relativePath) =>
    run.artifacts.includes(relativePath),
  );
  const exists = await Promise.all(
    renderPlanArtifactPaths.map((relativePath) => pathExists(resolveArtifact(relativePath))),
  );
  if (!registered && exists.every((item) => !item)) {
    return { status: "missing", requiredArtifacts: renderPlanArtifactPaths };
  }
  try {
    await assertRenderPlanArtifacts(run, resolveArtifact);
    const planText = await readFile(resolveArtifact("production/render_plan.json"), "utf8");
    const plan = renderPlanSchema.parse(JSON.parse(planText) as unknown);
    const provenance = assetProvenanceSchema.parse(
      await readJsonFile(resolveArtifact("production/asset_provenance.json")),
    );
    await assertRenderPlanEvidenceMatchesRun(projectRoot, run, plan, provenance);
    return {
      status: "pass",
      path: "production/render_plan.json",
      digest: createHash("sha256").update(planText, "utf8").digest("hex"),
      artifactCount: renderPlanArtifactPaths.length,
      assetCount: provenance.assets.length,
      ...(plan.schemaVersion === 2 ? { visualManifestDigest: plan.visualManifest.digest } : {}),
    };
  } catch (error) {
    return {
      status: "block",
      path: "production/render_plan.json",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

async function assertRenderPlanEvidenceMatchesRun(
  projectRoot: string,
  run: RunRecord,
  plan: RenderPlan,
  provenance: AssetProvenance,
): Promise<void> {
  if (plan.runId !== run.runId || provenance.runId !== run.runId) {
    throw new SafeExitError("Render plan evidence belongs to a different run.");
  }
  const { digest } = await verifyProductionPackageAtProjectRoot(projectRoot, run);
  if (plan.productionPackageManifestDigest !== digest) {
    throw new SafeExitError(
      "Render plan evidence was generated from a stale production package manifest.",
    );
  }
  if (plan.schemaVersion === 2) {
    const visualEvidence = await readApprovedVisualManifestEvidence(run, projectRoot);
    if (visualEvidence.status !== "pass" || visualEvidence.digest !== plan.visualManifest.digest) {
      throw new SafeExitError("Render plan evidence was generated from stale visual evidence.");
    }
  }
}

async function readProductionScenes(runId: string): Promise<ProductionScene[]> {
  const data = await readJsonFile<{ scenes: unknown[] }>(
    artifactPath(runId, "production/scenes.json"),
  );
  const scenes = z.array(productionSceneSchema).min(1).parse(data.scenes);
  return scenes.map((scene) => ({ ...scene }));
}

async function assertRenderPlanArtifacts(
  run: RunRecord,
  resolveArtifact: (relativePath: string) => string = (relativePath) =>
    artifactPath(run.runId, relativePath),
): Promise<void> {
  for (const relativePath of renderPlanArtifactPaths) {
    if (!run.artifacts.includes(relativePath)) {
      throw new SafeExitError(`Render plan artifact is not registered: ${relativePath}.`);
    }
    if (!(await pathExists(resolveArtifact(relativePath)))) {
      throw new SafeExitError(`Render plan artifact is missing: ${relativePath}.`);
    }
  }
}
