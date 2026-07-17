import { createHash } from "node:crypto";
import { artifactPathAtProjectRoot } from "../../core/artifactPaths.js";
import { readRegisteredArtifactBytesAtProjectRoot } from "../../core/artifactRevision.js";
import { SafeExitError } from "../../core/errors.js";
import { readProjectAssetBytesAtProjectRoot } from "../../core/projectAssets.js";
import type { RunRecord } from "../../core/state.js";
import { pathExists } from "../../utils/fs.js";
import { readJsonFile } from "../../utils/json.js";
import { verifyProductionPackageAtProjectRoot } from "../production/productionPackageIntegrity.js";
import { productionSceneSchema } from "../render/renderPlanSchemas.js";
import {
  visualArtifactPaths,
  visualContactSheetPath,
  type VisualManifest,
  type VisualManifestEvidence,
  visualManifestPath,
  visualManifestSchema,
} from "./visualContracts.js";
import { groupProductionScenesForVisuals } from "./visualSceneGroups.js";

export type LoadedVisualManifest = Readonly<{ digest: string; manifest: VisualManifest }>;

/** Reads and validates the active visual manifest without requiring approval decisions. */
export async function loadVisualManifest(
  run: RunRecord,
  projectRoot = process.cwd(),
): Promise<LoadedVisualManifest> {
  for (const relativePath of visualArtifactPaths) {
    if (!run.artifacts.includes(relativePath)) {
      throw new SafeExitError(`Visual artifact is not registered: ${relativePath}.`);
    }
    if (!(await pathExists(artifactPathAtProjectRoot(projectRoot, run.runId, relativePath)))) {
      throw new SafeExitError(`Visual artifact is missing: ${relativePath}.`);
    }
  }
  const manifestBytes = await readRegisteredArtifactBytesAtProjectRoot(
    projectRoot,
    run,
    visualManifestPath,
  );
  if (!manifestBytes) {
    throw new SafeExitError("Visual manifest is missing.");
  }
  const manifest = visualManifestSchema.parse(JSON.parse(manifestBytes.toString("utf8")));
  await assertManifestMatchesRun(projectRoot, run, manifest);
  return { digest: createHash("sha256").update(manifestBytes).digest("hex"), manifest };
}

/** Returns approved visual evidence for render planning, or an operator-facing block reason. */
export async function readApprovedVisualManifestEvidence(
  run: RunRecord,
  projectRoot = process.cwd(),
): Promise<VisualManifestEvidence> {
  const registered = visualArtifactPaths.some((relativePath) =>
    run.artifacts.includes(relativePath),
  );
  const existing = await Promise.all(
    visualArtifactPaths.map((relativePath) =>
      pathExists(artifactPathAtProjectRoot(projectRoot, run.runId, relativePath)),
    ),
  );
  if (!registered && existing.every((item) => !item)) {
    return { status: "missing", requiredArtifacts: visualArtifactPaths };
  }
  try {
    const loaded = await loadVisualManifest(run, projectRoot);
    const approvedSceneCount = loaded.manifest.scenes.filter(
      (scene) =>
        scene.decision?.status === "approved" && scene.decision.revision === scene.activeRevision,
    ).length;
    if (approvedSceneCount !== loaded.manifest.scenes.length) {
      throw new SafeExitError(
        `Visual review is incomplete (${approvedSceneCount}/${loaded.manifest.scenes.length} scenes approved).`,
      );
    }
    return {
      status: "pass",
      path: visualManifestPath,
      digest: loaded.digest,
      approvedSceneCount,
      sceneCount: loaded.manifest.scenes.length,
      manifest: loaded.manifest,
    };
  } catch (error) {
    return {
      status: "block",
      path: visualManifestPath,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Verifies that visual manifest evidence belongs to the run and matches its current production package, scenes, assets, and contact sheet.
 *
 * @param projectRoot - The project root containing the run artifacts and project assets.
 * @param run - The run whose production package and registered artifacts are validated.
 * @param manifest - The visual manifest to validate.
 * @throws SafeExitError If the manifest is owned by another run, is stale or inconsistent with the production package, references changed or missing assets, lacks an active revision, or the visual contact sheet is missing.
 */
async function assertManifestMatchesRun(
  projectRoot: string,
  run: RunRecord,
  manifest: VisualManifest,
): Promise<void> {
  if (manifest.runId !== run.runId) {
    throw new SafeExitError("Visual manifest belongs to a different run.");
  }
  const productionPackage = await verifyProductionPackageAtProjectRoot(projectRoot, run);
  if (manifest.productionPackage.digest !== productionPackage.digest) {
    throw new SafeExitError("Visual manifest was generated from a stale production package.");
  }
  const scenesArtifact = await readJsonFile<{ scenes: unknown[] }>(
    artifactPathAtProjectRoot(projectRoot, run.runId, "production/scenes.json"),
  );
  const scenes = productionSceneSchema.array().min(1).parse(scenesArtifact.scenes);
  const expectedGroups = groupProductionScenesForVisuals(scenes);
  if (expectedGroups.length !== manifest.scenes.length) {
    throw new SafeExitError("Visual manifest scene count does not match the production package.");
  }
  for (const scene of manifest.scenes) {
    const expectedGroup = expectedGroups.find((item) => item.sceneIndex === scene.sceneIndex);
    if (!expectedGroup) {
      throw new SafeExitError(
        `Visual manifest scene ${scene.sceneIndex} has stale prompt evidence.`,
      );
    }
    if (
      expectedGroup.visualPrompt !== scene.visualPrompt ||
      expectedGroup.promptDigest !== scene.promptDigest ||
      Math.abs(expectedGroup.durationSeconds - scene.durationSeconds) > 0.000001 ||
      JSON.stringify(expectedGroup.productionSceneIndexes) !==
        JSON.stringify(scene.productionSceneIndexes)
    ) {
      throw new SafeExitError(
        `Visual manifest scene ${scene.sceneIndex} has stale prompt evidence.`,
      );
    }
    const active = scene.revisions.find((item) => item.revision === scene.activeRevision);
    if (!active) {
      throw new SafeExitError(`Visual manifest scene ${scene.sceneIndex} has no active revision.`);
    }
    const bytes = active.asset.path.startsWith("assets/")
      ? await readProjectAssetBytesAtProjectRoot(projectRoot, active.asset.path)
      : await readRegisteredArtifactBytesAtProjectRoot(projectRoot, run, active.asset.path);
    if (!bytes || createHash("sha256").update(bytes).digest("hex") !== active.asset.digest) {
      throw new SafeExitError(
        `Visual asset changed after evidence was recorded: ${active.asset.path}.`,
      );
    }
  }
  if (
    !(await pathExists(artifactPathAtProjectRoot(projectRoot, run.runId, visualContactSheetPath)))
  ) {
    throw new SafeExitError("Visual contact sheet is missing.");
  }
}
