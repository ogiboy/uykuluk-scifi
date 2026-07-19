import { readFile } from "node:fs/promises";
import { z } from "zod";
import { loadConfig } from "../config/config.js";
import { artifactPath } from "../core/artifacts.js";
import { SafeExitError } from "../core/errors.js";
import { queueRunLedgerEvent, reconcileRunLedgerOutbox } from "../core/runLedgerOutbox.js";
import { mutateRun } from "../core/runStore.js";
import { requireState } from "../safeguards/approvalGuard.js";
import { nowIso } from "../utils/time.js";
import { verifyProductionPackage } from "./production/productionPackageIntegrity.js";
import { selectRenderAssets } from "./render/renderPlanAssets.js";
import { productionSceneSchema } from "./render/renderPlanSchemas.js";
import { captureVisualArtifactRollback } from "./visuals/visualArtifactRollback.js";
import {
  visualManifestPath,
  visualManifestSchema,
  type VisualDecision,
  type VisualManifest,
} from "./visuals/visualContracts.js";
import { loadVisualManifest } from "./visuals/visualManifest.js";
import {
  assertVisualMutationExpectation,
  type VisualMutationExpectation,
} from "./visuals/visualMutationExpectation.js";
import {
  invalidateVisualConsumers,
  persistVisualManifest,
  visualMutationRollbackPaths,
} from "./visuals/visualPersistence.js";
import { StaticVisualProvider } from "./visuals/visualProvider.js";
import { requireVisualReviewState } from "./visuals/visualReviewState.js";
import { createStaticVisualRevision } from "./visuals/visualRevisions.js";
import { groupProductionScenesForVisuals } from "./visuals/visualSceneGroups.js";

export { generateHostedVisuals } from "./visuals/hostedVisualGeneration.js";
export {
  generateLocalVisuals,
  type LocalVisualGeneratedImage,
  type LocalVisualGenerationBoundary,
  type LocalVisualLaunchPlan,
} from "./visuals/localVisualGeneration.js";
export { prepareHostedVisualGenerationPlan } from "./visuals/visualGenerationPlanStore.js";
export { importManualVisual } from "./visuals/visualManualImport.js";
export type { VisualMutationExpectation } from "./visuals/visualMutationExpectation.js";
export { regenerateRejectedStaticVisuals } from "./visuals/visualRegeneration.js";
export { activateVisualRevision } from "./visuals/visualRevisionActivation.js";

export type VisualDecisionInput = Readonly<{
  runId: string;
  sceneIndexes: readonly number[];
  status: "approved" | "rejected";
  reviewedBy: string;
  notes: string;
}> &
  VisualMutationExpectation;

/**
 * Creates a pending scene visual manifest from deterministic committed background assets for review.
 *
 * @param runId - The run whose production package and scenes provide the manifest evidence.
 * @returns The prepared visual manifest.
 * @throws SafeExitError if a visual manifest already exists or the run is not eligible for preparation.
 */
export async function prepareStaticVisuals(runId: string): Promise<VisualManifest> {
  await reconcileRunLedgerOutbox(runId);
  const config = await loadConfig();
  const assets = await selectRenderAssets(config.assets);
  const provider = new StaticVisualProvider(assets.backgrounds);
  const { value: manifest } = await mutateRun(runId, async (run, transaction) => {
    await requireState(run, "PRODUCTION_PACKAGE_GENERATED", "visuals-prepare");
    if (run.artifacts.includes(visualManifestPath)) {
      throw new SafeExitError(
        "Visual manifest already exists; review or revise the active scenes.",
      );
    }
    const productionPackage = await verifyProductionPackage(run);
    const scenes = await readProductionScenes(run.runId);
    const visualGroups = groupProductionScenesForVisuals(scenes);
    const createdAt = nowIso();
    const nextManifest = visualManifestSchema.parse({
      schemaVersion: 1,
      runId: run.runId,
      createdAt,
      updatedAt: createdAt,
      productionPackage: {
        path: "production/production_package.meta.json",
        digest: productionPackage.digest,
      },
      scenes: await Promise.all(
        visualGroups.map(async (scene) => ({
          sceneIndex: scene.sceneIndex,
          productionSceneIndexes: scene.productionSceneIndexes,
          durationSeconds: scene.durationSeconds,
          visualPrompt: scene.visualPrompt,
          promptDigest: scene.promptDigest,
          activeRevision: 1,
          revisions: [
            await createStaticVisualRevision(provider, {
              revision: 1,
              runId: run.runId,
              sceneIndex: scene.sceneIndex,
              visualPrompt: scene.visualPrompt,
            }),
          ],
        })),
      ),
    });
    transaction.onRollback(
      await captureVisualArtifactRollback(
        run.runId,
        "visuals-prepare",
        visualMutationRollbackPaths,
      ),
    );
    let updatedRun = await invalidateVisualConsumers(run, "visuals-prepare");
    updatedRun = await persistVisualManifest(updatedRun, nextManifest, "visuals-prepare");
    updatedRun = queueRunLedgerEvent(updatedRun, {
      type: "GUARD_PASSED",
      stage: "visuals-prepare",
      message: `Prepared ${nextManifest.scenes.length} static fallback scene visuals for review.`,
      data: { sceneCount: nextManifest.scenes.length, provider: "static" },
    });
    return { run: updatedRun, value: nextManifest };
  });
  await reconcileRunLedgerOutbox(runId);
  return manifest;
}

/**
 * Records attributed approval or rejection decisions for active visual revisions.
 *
 * The decision is permitted only during an eligible production or manual-production
 * state and requires reviewer attribution, notes, and existing scene indexes matching
 * the supplied mutation expectation. Updates the visual manifest, invalidates dependent
 * consumers, and records an operator-visible ledger event.
 *
 * @param input - Decision status, reviewer attribution, notes, scene indexes, and expected manifest evidence.
 * @returns The updated visual manifest.
 * @throws SafeExitError If review is blocked by the run state, required attribution or notes are missing, a scene does not exist, or the input expectation is stale.
 */
export async function decideVisuals(input: VisualDecisionInput): Promise<VisualManifest> {
  await reconcileRunLedgerOutbox(input.runId);
  const reviewedBy = input.reviewedBy.trim();
  const notes = input.notes.trim();
  if (!reviewedBy || !notes) {
    throw new SafeExitError("Visual decisions require reviewer attribution and notes.");
  }
  const requested = new Set(input.sceneIndexes);
  if (requested.size === 0) {
    throw new SafeExitError("Visual decision requires at least one scene.");
  }
  const { value: manifest } = await mutateRun(input.runId, async (run, transaction) => {
    await requireVisualReviewState(run, "visuals-decide");
    const loaded = await loadVisualManifest(run);
    assertVisualMutationExpectation(loaded, input);
    const available = new Set(loaded.manifest.scenes.map((scene) => scene.sceneIndex));
    for (const sceneIndex of requested) {
      if (!available.has(sceneIndex)) {
        throw new SafeExitError(`Visual scene ${sceneIndex} does not exist.`);
      }
    }
    const decidedAt = nowIso();
    const nextManifest = visualManifestSchema.parse({
      ...loaded.manifest,
      updatedAt: decidedAt,
      scenes: loaded.manifest.scenes.map((scene) =>
        requested.has(scene.sceneIndex)
          ? {
              ...scene,
              decision: {
                revision: scene.activeRevision,
                status: input.status,
                reviewedBy,
                notes,
                decidedAt,
              } satisfies VisualDecision,
            }
          : scene,
      ),
    });
    transaction.onRollback(
      await captureVisualArtifactRollback(run.runId, "visuals-decide", visualMutationRollbackPaths),
    );
    let updatedRun = await invalidateVisualConsumers(run, "visuals-decide");
    updatedRun = await persistVisualManifest(updatedRun, nextManifest, "visuals-decide");
    updatedRun = queueRunLedgerEvent(updatedRun, {
      type: "REVIEW_DECISION_RECORDED",
      stage: "visuals-decide",
      message: `Recorded ${input.status} for ${requested.size} active visual revision(s).`,
      data: { sceneIndexes: [...requested], status: input.status, reviewedBy },
    });
    return { run: updatedRun, value: nextManifest };
  });
  await reconcileRunLedgerOutbox(input.runId);
  return manifest;
}

/**
 * Reads and validates the committed production scenes evidence for a run.
 *
 * @param runId - The production run identifier
 * @returns The validated production scenes from the run artifact
 */
async function readProductionScenes(runId: string) {
  const parsed = JSON.parse(await readFile(artifactPath(runId, "production/scenes.json"), "utf8"));
  return z.array(productionSceneSchema).min(1).parse(parsed.scenes);
}
