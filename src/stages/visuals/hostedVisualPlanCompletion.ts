import { SafeExitError } from "../../core/errors.js";
import type { RunRecord } from "../../core/state.js";
import { readCostReservationSummariesAtProjectRoot } from "../../costs/costReservationStore.js";
import { requireHostedVisualSceneSpoolMatch } from "./hostedVisualSpoolEvidence.js";
import type { LoadedHostedVisualGenerationPlan } from "./visualGenerationPlanStore.js";
import {
  loadHostedVisualGenerationSpoolForOperation,
  type LoadedHostedVisualGenerationSpool,
} from "./visualGenerationSpool.js";
import { loadVisualManifest } from "./visualManifest.js";

/**
 * Verifies that a persisted hosted visual plan has an approved settled reservation and is fully reflected in scene history.
 *
 * @param input - The run, persisted hosted visual plan, and project root used for validation.
 * @returns The indexes of rejected scenes whose active hosted-generation revisions have valid settled evidence.
 * @throws SafeExitError If the reservation, approval, settlement identity, scene application, or evidence is invalid.
 */
export async function requireSettledAppliedHostedVisualPlan(input: {
  run: RunRecord;
  plan: LoadedHostedVisualGenerationPlan;
  projectRoot: string;
}): Promise<{ eligibleRejectedSceneIndexes: number[] }> {
  const reservations = await readCostReservationSummariesAtProjectRoot(
    input.projectRoot,
    input.run.runId,
  );
  const matches = reservations
    .filter((reservation) => reservation.stage === "imageGeneration")
    .filter((reservation) => reservation.bindingDigest === input.plan.digest)
    .filter((reservation) => reservation.status !== "RELEASED");
  if (matches.length !== 1 || matches[0]?.status !== "SETTLED") {
    throw new SafeExitError("Hosted visual plan has no exact settled reservation.");
  }
  const reservation = matches[0];
  requireSourceApproval(input.run, reservation.approvalId, reservation.quoteDigest);
  if (
    reservation.provider !== input.plan.plan.provider ||
    reservation.model !== input.plan.plan.model ||
    !reservation.resultEvidenceDigest
  ) {
    throw new SafeExitError("Hosted visual plan settlement identity is invalid.");
  }
  const spool = await loadHostedVisualGenerationSpoolForOperation(
    input.run.runId,
    reservation.operationId,
    reservation.resultEvidenceDigest,
  );
  const manifest = await loadVisualManifest(input.run, input.projectRoot);
  for (const planned of input.plan.plan.scenes) {
    const revision = manifest.manifest.scenes
      .find((scene) => scene.sceneIndex === planned.sceneIndex)
      ?.revisions.find(
        (candidate) =>
          candidate.source.kind === "hosted-generation" &&
          candidate.source.planDigest === input.plan.digest &&
          candidate.source.reservationId === reservation.reservationId,
      );
    if (!revision) {
      throw new SafeExitError(
        `Hosted visual plan scene ${planned.sceneIndex} was not fully applied.`,
      );
    }
    requireHostedVisualSceneSpoolMatch({
      sceneIndex: planned.sceneIndex,
      revision,
      reservation,
      spool,
    });
  }

  const reservationsById = new Map(reservations.map((item) => [item.reservationId, item]));
  const spoolByReservationId = new Map<string, LoadedHostedVisualGenerationSpool>([
    [reservation.reservationId, spool],
  ]);
  const eligibleRejectedSceneIndexes: number[] = [];
  for (const scene of manifest.manifest.scenes) {
    if (scene.decision?.status !== "rejected" || scene.decision.revision !== scene.activeRevision) {
      continue;
    }
    const active = scene.revisions.find((item) => item.revision === scene.activeRevision);
    if (!active || active.source.kind !== "hosted-generation") continue;
    const sourceReservation = reservationsById.get(active.source.reservationId);
    if (sourceReservation?.status !== "SETTLED" || !sourceReservation.resultEvidenceDigest) {
      throw new SafeExitError(
        `Rejected hosted visual scene ${scene.sceneIndex} has invalid settlement evidence.`,
      );
    }
    requireSourceApproval(input.run, active.source.approvalId, active.source.quoteDigest);
    let sourceSpool = spoolByReservationId.get(sourceReservation.reservationId);
    if (!sourceSpool) {
      sourceSpool = await loadHostedVisualGenerationSpoolForOperation(
        input.run.runId,
        sourceReservation.operationId,
        sourceReservation.resultEvidenceDigest,
      );
      spoolByReservationId.set(sourceReservation.reservationId, sourceSpool);
    }
    requireHostedVisualSceneSpoolMatch({
      sceneIndex: scene.sceneIndex,
      revision: active,
      reservation: sourceReservation,
      spool: sourceSpool,
    });
    eligibleRejectedSceneIndexes.push(scene.sceneIndex);
  }
  return { eligibleRejectedSceneIndexes };
}

/**
 * Verifies that a hosted visual source has current approval for its quoted generation cost.
 *
 * @param run - The run record containing approval entries.
 * @param approvalId - The required approval identifier.
 * @param quoteDigest - The digest of the approved cost quote.
 * @throws SafeExitError If no matching paid-generation-cost approval exists.
 */
function requireSourceApproval(run: RunRecord, approvalId: string, quoteDigest: string): void {
  if (
    !run.approvals.some(
      (item) =>
        item.approvalId === approvalId &&
        item.target === "paid-generation-cost" &&
        item.approvedRef === quoteDigest,
    )
  ) {
    throw new SafeExitError("Hosted visual source approval is missing or stale.");
  }
}
