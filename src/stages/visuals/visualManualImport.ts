import path from "node:path";
import { writeRunBinary } from "../../core/artifacts.js";
import { SafeExitError } from "../../core/errors.js";
import { queueRunLedgerEvent, reconcileRunLedgerOutbox } from "../../core/runLedgerOutbox.js";
import { mutateRun } from "../../core/runStore.js";
import { requireState } from "../../safeguards/approvalGuard.js";
import { nowIso } from "../../utils/time.js";
import { captureVisualArtifactRollback } from "./visualArtifactRollback.js";
import { visualManifestSchema, type VisualManifest } from "./visualContracts.js";
import { loadVisualManifest } from "./visualManifest.js";
import {
  assertVisualMutationExpectation,
  type VisualMutationExpectation,
} from "./visualMutationExpectation.js";
import {
  invalidateVisualConsumers,
  persistVisualManifest,
  visualMutationRollbackPaths,
} from "./visualPersistence.js";
import { ManualImportVisualProvider } from "./visualProvider.js";
import { manualVisualRevision, visualRevisionPath } from "./visualRevisions.js";

/**
 * Imports a manual visual revision for a scene and invalidates dependent visual consumers.
 *
 * The operation requires the run to be ready for visual mutations and the supplied
 * mutation expectation to match the current manifest. It writes the source image,
 * activates the new revision, clears the scene decision, records rollback metadata,
 * and queues an artifact revision ledger event.
 *
 * @param input - The run, scene, source image path, and expected manifest state.
 * @returns The updated visual manifest.
 * @throws SafeExitError If the manual provider returns an unexpected result or the scene does not exist.
 */
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
    if (!scene) throw new SafeExitError(`Visual scene ${input.sceneIndex} does not exist.`);
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
