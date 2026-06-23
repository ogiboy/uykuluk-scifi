import { SafeExitError } from "../core/errors.js";
import { appendLedgerEvent } from "../core/ledger.js";
import { checkBudget } from "../safeguards/budgetGuard.js";
import { createId, nowIso } from "../utils/time.js";
import {
  appendUncertainEvent,
  loadApprovedQuoteLine,
  requireReservation,
  requireReservationText,
} from "./costReservationContext.js";
import { withCostReservationLock } from "./costReservationLock.js";
import {
  appendCostReservationEvent,
  CostReservationSummary,
  readAllCostReservationSummaries,
} from "./costReservationStore.js";
import { microsToUsd } from "./money.js";
export { reconcileCostReservation, settleCostReservation } from "./costSettlementService.js";

/**
 * Creates or returns a cost reservation for an approved quote line.
 *
 * If a reservation with the same operation ID already exists with matching run, stage, approval, and quote digest, returns the existing reservation. Otherwise, validates budget constraints and records a new reservation in both the cost reservation and ledger stores.
 *
 * @returns The cost reservation summary.
 * @throws SafeExitError if the operation ID is already bound to different bindings, if the approved quote line is already consumed, if budget validation fails, or if stage or operation ID is empty.
 */
export async function reserveApprovedCost(input: {
  runId: string;
  stage: string;
  operationId: string;
  adapterIdentity: {
    provider: string;
    model?: string;
  };
}): Promise<CostReservationSummary> {
  requireReservationText(input.stage, "stage");
  requireReservationText(input.operationId, "operation id");
  return withCostReservationLock(async () => {
    const context = await loadApprovedQuoteLine(input.runId, input.stage);
    if (
      input.adapterIdentity.provider !== context.provider ||
      input.adapterIdentity.model !== context.model
    ) {
      throw new SafeExitError(
        `Blocked: adapter provider/model does not match the approved quote for ${input.stage}.`,
      );
    }
    const all = await readAllCostReservationSummaries();
    const sameOperation = all.find((item) => item.operationId === input.operationId);
    if (sameOperation) {
      if (
        sameOperation.runId === input.runId &&
        sameOperation.stage === input.stage &&
        sameOperation.approvalId === context.approvalId &&
        sameOperation.quoteDigest === context.quoteDigest
      ) {
        return sameOperation;
      }
      throw new SafeExitError(`Operation id is already bound: ${input.operationId}.`);
    }
    const consumed = all.find(
      (item) =>
        item.runId === input.runId &&
        item.approvalId === context.approvalId &&
        item.stage === input.stage,
    );
    if (consumed) {
      throw new SafeExitError(
        `Approved quote line ${input.stage} is already consumed; create a new quote and approval.`,
      );
    }
    const budget = await checkBudget({
      run: context.run,
      config: context.config,
      stage: `reserve-${input.stage}`,
      provider: context.provider,
      model: context.model,
      estimatedUsd: microsToUsd(context.maxUsdMicros),
      recordCostEvent: false,
    });
    if (!budget.allowed) {
      throw new SafeExitError(
        `Blocked: reservation budget failed. ${budget.blockedReasons.join(" ")}`,
      );
    }
    const reservationId = createId("reservation");
    await appendCostReservationEvent({
      eventId: createId("reservation_event"),
      reservationId,
      runId: input.runId,
      type: "RESERVED",
      operationId: input.operationId,
      approvalId: context.approvalId,
      quoteDigest: context.quoteDigest,
      stage: input.stage,
      provider: context.provider,
      model: context.model,
      maxUsdMicros: context.maxUsdMicros,
      createdAt: nowIso(),
    });
    await appendLedgerEvent({
      runId: input.runId,
      type: "COST_RESERVED",
      stage: input.stage,
      message: "Approved cost quote line reserved.",
      data: { reservationId, operationId: input.operationId, maxUsdMicros: context.maxUsdMicros },
    });
    return requireReservation(input.runId, reservationId);
  });
}

/**
 * Releases an existing cost reservation from the reserved state.
 *
 * @returns The updated cost reservation summary.
 * @throws `SafeExitError` if the reservation is not in the reserved state.
 */
export async function releaseCostReservation(input: {
  runId: string;
  reservationId: string;
  reason: string;
}): Promise<CostReservationSummary> {
  requireReservationText(input.reason, "release reason");
  return withCostReservationLock(async () => {
    const reservation = await requireReservation(input.runId, input.reservationId);
    if (reservation.status === "RELEASED") {
      return reservation;
    }
    if (reservation.status !== "RESERVED") {
      throw new SafeExitError(`Cannot release reservation in state ${reservation.status}.`);
    }
    await appendCostReservationEvent({
      eventId: createId("reservation_event"),
      reservationId: input.reservationId,
      runId: input.runId,
      type: "RELEASED",
      reason: input.reason,
      createdAt: nowIso(),
    });
    await appendLedgerEvent({
      runId: input.runId,
      type: "COST_RELEASED",
      stage: reservation.stage,
      message: "Cost reservation released without provider settlement.",
      data: { reservationId: input.reservationId, reason: input.reason },
    });
    return requireReservation(input.runId, input.reservationId);
  });
}

/**
 * Marks a cost reservation as uncertain.
 *
 * @returns The updated reservation summary
 */
export async function markCostReservationUncertain(input: {
  runId: string;
  reservationId: string;
  reason: string;
  providerRequestIdHash?: string;
}): Promise<CostReservationSummary> {
  requireReservationText(input.reason, "uncertain outcome reason");
  return withCostReservationLock(async () => {
    const reservation = await requireReservation(input.runId, input.reservationId);
    if (reservation.status === "UNCERTAIN") {
      return reservation;
    }
    if (!["RESERVED", "EXECUTION_STARTED"].includes(reservation.status)) {
      throw new SafeExitError(`Cannot mark reservation uncertain from ${reservation.status}.`);
    }
    await appendUncertainEvent(reservation, input.reason, input.providerRequestIdHash);
    return requireReservation(input.runId, input.reservationId);
  });
}
