import { loadConfig } from "../../config/config.js";
import { SafeExitError } from "../../core/errors.js";
import { appendLedgerEvent } from "../../core/ledger.js";
import { mutateRun } from "../../core/runStore.js";
import { requireState } from "../../safeguards/approvalGuard.js";
import { nowIso } from "../../utils/time.js";
import { selectRenderAssets } from "../render/renderPlanAssets.js";
import { captureVisualArtifactRollback } from "./visualArtifactRollback.js";
import {
  visualManifestSchema,
  type VisualManifest,
  type VisualRevision,
} from "./visualContracts.js";
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
import { StaticVisualProvider } from "./visualProvider.js";
import { createStaticVisualRevision } from "./visualRevisions.js";

/** Regenerates rejected scenes as deterministic static next revisions. */
export async function regenerateRejectedStaticVisuals(
  input: Readonly<{ runId: string; sceneIndexes: readonly number[] }> & VisualMutationExpectation,
): Promise<VisualManifest> {
  const requested = new Set(input.sceneIndexes);
  if (requested.size === 0) {
    throw new SafeExitError("Visual regeneration requires at least one rejected scene.");
  }
  const config = await loadConfig();
  const assets = await selectRenderAssets(config.assets);
  const provider = new StaticVisualProvider(assets.backgrounds);
  const { value: manifest } = await mutateRun(input.runId, async (run, transaction) => {
    await requireState(run, "PRODUCTION_PACKAGE_GENERATED", "visuals-regenerate");
    const loaded = await loadVisualManifest(run);
    assertVisualMutationExpectation(loaded, input);
    const requestedScenes = loaded.manifest.scenes.filter((scene) =>
      requested.has(scene.sceneIndex),
    );
    if (requestedScenes.length !== requested.size) {
      throw new SafeExitError("Visual regeneration includes an unknown scene.");
    }
    const nonRejected = requestedScenes.find(
      (scene) =>
        scene.decision?.status !== "rejected" || scene.decision.revision !== scene.activeRevision,
    );
    if (nonRejected) {
      throw new SafeExitError(
        `Visual scene ${nonRejected.sceneIndex} must reject its active revision before regeneration.`,
      );
    }
    const revisions = new Map<number, VisualRevision>();
    for (const scene of requestedScenes) {
      const nextRevision = Math.max(...scene.revisions.map((item) => item.revision)) + 1;
      revisions.set(
        scene.sceneIndex,
        await createStaticVisualRevision(provider, {
          revision: nextRevision,
          runId: input.runId,
          sceneIndex: scene.sceneIndex,
          visualPrompt: scene.visualPrompt,
        }),
      );
    }
    const nextManifest = visualManifestSchema.parse({
      ...loaded.manifest,
      updatedAt: nowIso(),
      scenes: loaded.manifest.scenes.map((scene) => {
        const revision = revisions.get(scene.sceneIndex);
        return revision
          ? {
              ...scene,
              activeRevision: revision.revision,
              revisions: [...scene.revisions, revision],
              decision: undefined,
            }
          : scene;
      }),
    });
    transaction.onRollback(
      await captureVisualArtifactRollback(
        run.runId,
        "visuals-regenerate",
        visualMutationRollbackPaths,
      ),
    );
    let updatedRun = await invalidateVisualConsumers(run, "visuals-regenerate");
    updatedRun = await persistVisualManifest(updatedRun, nextManifest, "visuals-regenerate");
    return { run: updatedRun, value: nextManifest };
  });
  await appendLedgerEvent({
    runId: input.runId,
    type: "ARTIFACT_REVISED",
    stage: "visuals-regenerate",
    message: `Regenerated ${requested.size} rejected visual scene(s) as static fallback revisions.`,
    data: { sceneIndexes: [...requested] },
  });
  return manifest;
}
