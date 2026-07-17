import { SafeExitError } from "../../core/errors.js";
import type { RunRecord } from "../../core/state.js";
import { settleCostReservation } from "../../costs/costReservationService.js";
import {
  readCostReservationSummaries,
  type CostReservationSummary,
} from "../../costs/costReservationStore.js";
import {
  hostedVisualExecutionConfirmationMatches,
  hostedVisualExecutionConfirmationSchema,
  type HostedVisualExecutionConfirmation,
} from "./hostedVisualExecutionConfirmation.js";
import {
  requireCommittedHostedVisualSpool,
  requireHostedVisualResultDigest,
  requireSettledHostedVisualSpool,
} from "./hostedVisualSpoolEvidence.js";
import { createHostedVisualGenerationOperationId } from "./visualGenerationOperation.js";
import {
  loadPersistedHostedVisualGenerationPlan,
  type LoadedHostedVisualGenerationPlan,
} from "./visualGenerationPlanStore.js";
import {
  loadHostedVisualGenerationSpoolForOperation,
  type LoadedHostedVisualGenerationSpool,
} from "./visualGenerationSpool.js";

export type RecoveredHostedVisualGeneration = Readonly<{
  plan: LoadedHostedVisualGenerationPlan;
  reservation: CostReservationSummary;
  spool: LoadedHostedVisualGenerationSpool;
}>;

/** Recovers an exact committed hosted batch without requiring another provider request or key. */
export async function recoverCommittedHostedVisualGeneration(input: {
  confirmation: HostedVisualExecutionConfirmation;
  run: RunRecord;
}): Promise<RecoveredHostedVisualGeneration | null> {
  const confirmation = hostedVisualExecutionConfirmationSchema.parse(input.confirmation);
  const plan = await loadPersistedHostedVisualGenerationPlan(input.run);
  if (
    !hostedVisualExecutionConfirmationMatches(confirmation, {
      approvalId: confirmation.approvalId,
      bindingDigest: plan.digest,
      quoteDigest: confirmation.quoteDigest,
    })
  ) {
    return null;
  }
  const operationId = createHostedVisualGenerationOperationId({
    runId: input.run.runId,
    planDigest: plan.digest,
    quoteDigest: confirmation.quoteDigest,
    approvalId: confirmation.approvalId,
  });
  const matches = (await readCostReservationSummaries(input.run.runId)).filter(
    (reservation) => reservation.operationId === operationId,
  );
  if (matches.length === 0) return null;
  if (matches.length !== 1) {
    throw new SafeExitError("Hosted visual operation has ambiguous reservation evidence.");
  }
  let reservation = matches[0]!;
  if (
    reservation.stage !== "imageGeneration" ||
    reservation.provider !== plan.plan.provider ||
    reservation.model !== plan.plan.model ||
    reservation.bindingDigest !== plan.digest ||
    reservation.quoteDigest !== confirmation.quoteDigest ||
    reservation.approvalId !== confirmation.approvalId ||
    !input.run.approvals.some(
      (approval) =>
        approval.approvalId === reservation.approvalId &&
        approval.target === "paid-generation-cost" &&
        approval.approvedRef === reservation.quoteDigest,
    )
  ) {
    throw new SafeExitError("Hosted visual recovery identity does not match its approved plan.");
  }
  if (!["SETTLEMENT_PENDING", "SETTLED"].includes(reservation.status)) return null;
  const resultEvidenceDigest = requireHostedVisualResultDigest(reservation.resultEvidenceDigest);
  const spool = await loadHostedVisualGenerationSpoolForOperation(
    input.run.runId,
    operationId,
    resultEvidenceDigest,
  );
  requireCommittedHostedVisualSpool({
    spool,
    reservation,
    planDigest: plan.digest,
    approvedQuote: { approvalId: confirmation.approvalId, quoteDigest: confirmation.quoteDigest },
  });
  if (reservation.status === "SETTLEMENT_PENDING") {
    reservation = await settleCostReservation({
      runId: input.run.runId,
      reservationId: reservation.reservationId,
      actualUsdMicros: reservation.actualUsdMicros!,
      providerRequestIdHash: reservation.providerRequestIdHash,
      resultEvidenceDigest,
    });
  }
  return {
    plan,
    reservation,
    spool: requireSettledHostedVisualSpool({
      spool,
      reservation,
      planDigest: plan.digest,
      approvedQuote: { approvalId: confirmation.approvalId, quoteDigest: confirmation.quoteDigest },
    }),
  };
}
