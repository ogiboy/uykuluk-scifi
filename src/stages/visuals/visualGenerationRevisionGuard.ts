import { SafeExitError } from "../../core/errors.js";
import { appendLedgerEvent } from "../../core/ledger.js";
import type { RunRecord } from "../../core/state.js";
import type { CostReservationSummary } from "../../costs/costReservationStore.js";
import type { VisualScene } from "./visualContracts.js";
import { hostedVisualGenerationPlanPath } from "./visualGenerationPlanContracts.js";

/**
 * Creates an error for a blocked hosted visual revision.
 *
 * @param message - The operator-visible reason for blocking the revision.
 * @returns A `SafeExitError` containing the provided message.
 */
export async function hostedVisualRevisionBlocked(
  _runId: string,
  message: string,
): Promise<SafeExitError> {
  return new SafeExitError(message);
}

/**
 * Finds the cost approval whose settled reservation is bound to the hosted visual plan.
 *
 * @param approvals - Persisted run approvals available for matching.
 * @param reservations - Cost reservations that may prove completed execution.
 * @param planDigest - Exact hosted visual plan binding digest.
 * @returns The matching paid-generation approval, or `undefined` when no settled binding exists.
 */
export function findHostedVisualQuoteApproval(
  approvals: RunRecord["approvals"],
  reservations: readonly CostReservationSummary[],
  planDigest: string,
): RunRecord["approvals"][number] | undefined {
  return approvals.find(
    (approval) =>
      approval.target === "paid-generation-cost" &&
      reservations.some(
        (reservation) =>
          reservation.status === "SETTLED" &&
          reservation.bindingDigest === planDigest &&
          reservation.approvalId === approval.approvalId &&
          reservation.quoteDigest === approval.approvedRef,
      ),
  );
}

/**
 * Builds the filesystem paths for a hosted visual revision and its archived generation plan.
 *
 * @param revisionId - The hosted visual revision identifier.
 * @returns The archived generation plan path and revision metadata path.
 */
export function hostedVisualRevisionPaths(revisionId: string): {
  archivedPlanPath: string;
  revisionPath: string;
} {
  const revisionDir = `revisions/hosted-visual/${revisionId}`;
  return {
    archivedPlanPath: `${revisionDir}/invalidated/${hostedVisualGenerationPlanPath}`,
    revisionPath: `${revisionDir}/revision.json`,
  };
}

/**
 * Validates that each requested hosted visual scene has rejected its active revision before regeneration.
 *
 * @param scenes - The available visual scenes.
 * @param requestedSceneIndexes - The scene indexes requested for regeneration.
 * @returns The requested scenes after validation.
 * @throws A `SafeExitError` if a requested scene is missing, has not been rejected, or rejected a revision other than its active revision.
 */
export async function requireRejectedHostedVisualScenes(
  scenes: readonly VisualScene[],
  requestedSceneIndexes: readonly number[],
): Promise<VisualScene[]> {
  const rejectedScenes: VisualScene[] = [];
  for (const sceneIndex of requestedSceneIndexes) {
    const scene = scenes.find((item) => item.sceneIndex === sceneIndex);
    if (
      !scene ||
      scene.decision?.status !== "rejected" ||
      scene.decision.revision !== scene.activeRevision
    ) {
      throw await hostedVisualRevisionBlocked(
        "",
        `Hosted visual scene ${sceneIndex} must reject its active revision before regeneration.`,
      );
    }
    rejectedScenes.push(scene);
  }
  return rejectedScenes;
}

/**
 * Validates and normalizes hosted visual scene indexes for regeneration.
 *
 * @param sceneIndexes - The requested scene indexes, which must be unique.
 * @returns The scene indexes sorted in ascending order.
 * @throws A `SafeExitError` if duplicate indexes are provided.
 */
export async function requireUniqueHostedVisualSceneIndexes(
  sceneIndexes: readonly number[],
): Promise<number[]> {
  const requested = Array.from(new Set(sceneIndexes)).sort((left, right) => left - right);
  if (requested.length !== sceneIndexes.length) {
    throw await hostedVisualRevisionBlocked(
      "",
      "Hosted visual regeneration targets must be unique.",
    );
  }
  return requested;
}

/**
 * Records a hosted visual revision guard block for safe-exit errors and rethrows the original error.
 *
 * @param runId - The run identifier associated with the blocked revision.
 * @param error - The error to persist when it is a `SafeExitError` and then rethrow.
 */
export async function persistHostedVisualRevisionBlock(
  runId: string,
  error: unknown,
): Promise<never> {
  if (error instanceof SafeExitError) {
    await appendLedgerEvent({
      runId,
      type: "GUARD_BLOCKED",
      stage: "visuals-hosted-reopen",
      message: error.message,
    });
  }
  throw error;
}
