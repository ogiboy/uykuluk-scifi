import { recordRunArtifact } from "../../core/artifacts.js";
import { SafeExitError } from "../../core/errors.js";
import { queueRunLedgerEvent, reconcileRunLedgerOutbox } from "../../core/runLedgerOutbox.js";
import { mutateRun } from "../../core/runStore.js";
import type { CostReservationSummary } from "../../costs/costReservationStore.js";
import { nowIso } from "../../utils/time.js";
import { captureVisualArtifactRollback } from "./visualArtifactRollback.js";
import {
  visualManifestSchema,
  type VisualManifest,
  type VisualRevision,
} from "./visualContracts.js";
import { canonicalVisualGenerationDigest } from "./visualGenerationDigest.js";
import type { LoadedHostedVisualGenerationPlan } from "./visualGenerationPlanStore.js";
import type { LoadedHostedVisualGenerationSpool } from "./visualGenerationSpool.js";
import { loadVisualManifest } from "./visualManifest.js";
import {
  invalidateVisualConsumers,
  persistVisualManifest,
  visualMutationRollbackPaths,
} from "./visualPersistence.js";
import { hostedVisualRevision } from "./visualRevisions.js";

/** Promotes a settled hosted batch into active scene revisions without copying provider bytes. */
export async function applySettledHostedVisuals(input: {
  runId: string;
  plan: LoadedHostedVisualGenerationPlan;
  spool: LoadedHostedVisualGenerationSpool;
  reservation: CostReservationSummary;
}): Promise<VisualManifest> {
  await reconcileRunLedgerOutbox(input.runId);
  const { value } = await mutateRun(input.runId, async (run, transaction) => {
    const allowedStates = ["PAID_GENERATION_COST_APPROVED", "READY_FOR_MANUAL_PRODUCTION"] as const;
    if (!allowedStates.includes(run.state as (typeof allowedStates)[number])) {
      throw new SafeExitError(
        `Hosted visual apply requires state ${allowedStates.join(" or ")}; current state is ${run.state}.`,
      );
    }
    if (
      input.reservation.status !== "SETTLED" ||
      input.reservation.runId !== run.runId ||
      input.reservation.operationId !== input.spool.spool.operationId ||
      input.reservation.bindingDigest !== input.plan.digest ||
      input.spool.spool.plan.digest !== input.plan.digest
    ) {
      throw new SafeExitError("Hosted visual settlement does not match the active run plan.");
    }
    const loaded = await loadVisualManifest(run);
    const appliedScenes = input.plan.plan.scenes.filter((planned) => {
      const scene = loaded.manifest.scenes.find(
        (candidate) => candidate.sceneIndex === planned.sceneIndex,
      );
      const active = scene?.revisions.find(
        (revision) => revision.revision === scene.activeRevision,
      );
      return (
        active?.source.kind === "hosted-generation" &&
        active.source.operationId === input.reservation.operationId &&
        active.source.planDigest === input.plan.digest &&
        active.source.reservationId === input.reservation.reservationId &&
        active.source.resultSpool.digest === input.spool.reference.digest
      );
    });
    if (appliedScenes.length === input.plan.plan.scenes.length) {
      return { run, value: loaded.manifest };
    }
    if (appliedScenes.length > 0) {
      throw new SafeExitError(
        "Hosted visual batch is only partially applied; operator repair is required.",
      );
    }
    if (loaded.digest !== input.plan.plan.visualManifest.digest) {
      throw new SafeExitError(
        "Hosted visual manifest changed after provider execution was approved.",
      );
    }
    const revisions = new Map<number, VisualRevision>();
    for (const planned of input.plan.plan.scenes) {
      const scene = loaded.manifest.scenes.find(
        (candidate) => candidate.sceneIndex === planned.sceneIndex,
      );
      const active = scene?.revisions.find(
        (revision) => revision.revision === scene.activeRevision,
      );
      if (
        !scene ||
        !active ||
        scene.activeRevision !== planned.activeRevision ||
        canonicalVisualGenerationDigest(active) !== planned.activeRevisionDigest
      ) {
        throw new SafeExitError(
          `Hosted visual scene ${planned.sceneIndex} changed after plan approval.`,
        );
      }
      const nextRevision = Math.max(...scene.revisions.map((item) => item.revision)) + 1;
      revisions.set(
        scene.sceneIndex,
        hostedVisualRevision(input.spool, input.reservation, scene.sceneIndex, nextRevision),
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
        "visuals-hosted-apply",
        visualMutationRollbackPaths,
      ),
    );
    let updatedRun = await recordRunArtifact(
      run,
      "visuals-hosted-apply",
      input.spool.reference.path,
    );
    updatedRun = await recordRunArtifact(
      updatedRun,
      "visuals-hosted-apply",
      input.spool.spool.plan.path,
    );
    for (const image of input.spool.spool.images) {
      updatedRun = await recordRunArtifact(updatedRun, "visuals-hosted-apply", image.asset.path);
    }
    updatedRun = await invalidateVisualConsumers(updatedRun, "visuals-hosted-apply");
    updatedRun = await persistVisualManifest(updatedRun, nextManifest, "visuals-hosted-apply");
    updatedRun = queueRunLedgerEvent(updatedRun, {
      type: "ARTIFACT_REVISED",
      stage: "visuals-hosted-apply",
      message: `Applied ${revisions.size} settled FLUX.2 Pro scene revision(s).`,
      data: {
        actualUsdMicros: input.reservation.actualUsdMicros,
        operationId: input.reservation.operationId,
        reservationId: input.reservation.reservationId,
        sceneIndexes: [...revisions.keys()],
      },
    });
    return { run: updatedRun, value: nextManifest };
  });
  await reconcileRunLedgerOutbox(input.runId);
  return value;
}
