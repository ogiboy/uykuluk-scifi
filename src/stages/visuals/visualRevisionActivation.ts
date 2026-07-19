import { SafeExitError } from "../../core/errors.js";
import { queueRunLedgerEvent, reconcileRunLedgerOutbox } from "../../core/runLedgerOutbox.js";
import { mutateRun } from "../../core/runStore.js";
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
import { requireVisualReviewState } from "./visualReviewState.js";

/**
 * Activates an existing visual revision for a scene and reopens the scene for review.
 *
 * Requires the run to be in the visual review state and the supplied mutation
 * expectations to match the stored manifest. Invalidates visual consumers,
 * persists the updated manifest, and records an artifact revision event.
 *
 * @param input - Identifies the run, scene, revision, and expected manifest state.
 * @returns The updated visual manifest.
 * @throws SafeExitError If the scene or revision does not exist.
 */
export async function activateVisualRevision(
  input: Readonly<{ runId: string; sceneIndex: number; revision: number }> &
    VisualMutationExpectation,
): Promise<VisualManifest> {
  await reconcileRunLedgerOutbox(input.runId);
  const { value: manifest } = await mutateRun(input.runId, async (run, transaction) => {
    await requireVisualReviewState(run, "visuals-activate-revision");
    const loaded = await loadVisualManifest(run);
    assertVisualMutationExpectation(loaded, input);
    const selected = loaded.manifest.scenes.find((scene) => scene.sceneIndex === input.sceneIndex);
    if (!selected) throw new SafeExitError(`Visual scene ${input.sceneIndex} does not exist.`);
    if (!selected.revisions.some((revision) => revision.revision === input.revision)) {
      throw new SafeExitError(
        `Visual revision ${input.revision} does not exist for scene ${input.sceneIndex}.`,
      );
    }
    transaction.onRollback(
      await captureVisualArtifactRollback(
        run.runId,
        "visuals-activate-revision",
        visualMutationRollbackPaths,
      ),
    );
    const nextManifest = visualManifestSchema.parse({
      ...loaded.manifest,
      updatedAt: nowIso(),
      scenes: loaded.manifest.scenes.map((scene) =>
        scene.sceneIndex === input.sceneIndex
          ? { ...scene, activeRevision: input.revision, decision: undefined }
          : scene,
      ),
    });
    let updatedRun = await invalidateVisualConsumers(run, "visuals-activate-revision");
    updatedRun = await persistVisualManifest(updatedRun, nextManifest, "visuals-activate-revision");
    updatedRun = queueRunLedgerEvent(updatedRun, {
      type: "ARTIFACT_REVISED",
      stage: "visuals-activate-revision",
      message: `Activated visual revision ${input.revision} for scene ${input.sceneIndex}; review is required again.`,
      data: { revision: input.revision, sceneIndex: input.sceneIndex },
    });
    return { run: updatedRun, value: nextManifest };
  });
  await reconcileRunLedgerOutbox(input.runId);
  return manifest;
}
