import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { loadConfig } from "../config/config.js";
import { artifactPath, writeRunBinary } from "../core/artifacts.js";
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
import { ManualImportVisualProvider, StaticVisualProvider } from "./visuals/visualProvider.js";
import {
  createStaticVisualRevision,
  manualVisualRevision,
  visualRevisionPath,
} from "./visuals/visualRevisions.js";
import { groupProductionScenesForVisuals } from "./visuals/visualSceneGroups.js";

export type { VisualMutationExpectation } from "./visuals/visualMutationExpectation.js";
export { regenerateRejectedStaticVisuals } from "./visuals/visualRegeneration.js";

export type VisualDecisionInput = Readonly<{
  runId: string;
  sceneIndexes: readonly number[];
  status: "approved" | "rejected";
  reviewedBy: string;
  notes: string;
}> &
  VisualMutationExpectation;

/** Creates a pending scene manifest using deterministic committed background assets. */
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

/** Imports a new manual image revision for one scene and invalidates stale render planning. */
export async function importManualVisual(
  input: { runId: string; sceneIndex: number; sourcePath: string } & VisualMutationExpectation,
): Promise<VisualManifest> {
  await reconcileRunLedgerOutbox(input.runId);
  const provider = new ManualImportVisualProvider(path.resolve(input.sourcePath));
  const result = await provider.createSceneVisual({
    revision: 1,
    runId: input.runId,
    sceneIndex: input.sceneIndex,
    visualPrompt: "manual import",
  });
  if (result.provider !== "manual-import") {
    throw new SafeExitError("Manual visual provider returned an unexpected result.");
  }
  const mutation = await mutateRun(input.runId, async (run, transaction) => {
    await requireState(run, "PRODUCTION_PACKAGE_GENERATED", "visuals-import");
    const loaded = await loadVisualManifest(run);
    assertVisualMutationExpectation(loaded, input);
    const scene = loaded.manifest.scenes.find((item) => item.sceneIndex === input.sceneIndex);
    if (!scene) {
      throw new SafeExitError(`Visual scene ${input.sceneIndex} does not exist.`);
    }
    const nextRevision = Math.max(...scene.revisions.map((item) => item.revision)) + 1;
    const relativePath = visualRevisionPath(input.sceneIndex, nextRevision, result.extension);
    transaction.onRollback(
      await captureVisualArtifactRollback(input.runId, "visuals-import", [
        ...visualMutationRollbackPaths,
        relativePath,
      ]),
    );
    let updatedRun = await writeRunBinary(run, "visuals-import", relativePath, result.bytes);
    const revision = manualVisualRevision(result, input.sceneIndex, nextRevision, relativePath);
    const nextManifest = visualManifestSchema.parse({
      ...loaded.manifest,
      updatedAt: nowIso(),
      scenes: loaded.manifest.scenes.map((item) =>
        item.sceneIndex === input.sceneIndex
          ? {
              ...item,
              activeRevision: nextRevision,
              revisions: [...item.revisions, revision],
              decision: undefined,
            }
          : item,
      ),
    });
    updatedRun = await invalidateVisualConsumers(updatedRun, "visuals-import");
    updatedRun = await persistVisualManifest(updatedRun, nextManifest, "visuals-import");
    updatedRun = queueRunLedgerEvent(updatedRun, {
      type: "ARTIFACT_REVISED",
      stage: "visuals-import",
      message: `Imported manual visual revision ${nextRevision} for scene ${input.sceneIndex}.`,
      data: { assetPath: relativePath, revision: nextRevision, sceneIndex: input.sceneIndex },
    });
    return { run: updatedRun, value: nextManifest };
  });
  await reconcileRunLedgerOutbox(input.runId);
  return mutation.value;
}

/** Records attributed approve/reject decisions for active scene revisions. */
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
    await requireState(run, "PRODUCTION_PACKAGE_GENERATED", "visuals-decide");
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

async function readProductionScenes(runId: string) {
  const parsed = JSON.parse(await readFile(artifactPath(runId, "production/scenes.json"), "utf8"));
  return z.array(productionSceneSchema).min(1).parse(parsed.scenes);
}
