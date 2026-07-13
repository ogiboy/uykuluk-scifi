import { SafeExitError } from "../core/errors.js";
import { appendLedgerEvent } from "../core/ledger.js";
import { createId, nowIso } from "../utils/time.js";
import { requireReservation } from "./costReservationContext.js";
import { withCostReservationLock } from "./costReservationLock.js";
import { appendCostReservationEvent, CostReservationSummary } from "./costReservationStore.js";
import {
  type ProviderAdapterIdentity,
  providerAdapterIdentitiesMatch,
} from "./providerAdapterIdentity.js";

/**
 * Attempts to start execution for a matching reserved cost reservation.
 *
 * @returns The current reservation and whether execution was started.
 */
export async function beginCostReservationExecution(input: {
  runId: string;
  reservationId: string;
  adapterIdentity: ProviderAdapterIdentity;
}): Promise<{ reservation: CostReservationSummary; started: boolean }> {
  return withCostReservationLock(async () => {
    const reservation = await requireReservation(input.runId, input.reservationId);
    requireMatchingAdapter(reservation, input.adapterIdentity, "execution");
    if (reservation.status !== "RESERVED") {
      return { reservation, started: false };
    }
    await appendCostReservationEvent({
      eventId: createId("reservation_event"),
      reservationId: input.reservationId,
      runId: input.runId,
      type: "EXECUTION_STARTED",
      provider: reservation.provider,
      ...(reservation.model ? { model: reservation.model } : {}),
      ...(reservation.bindingDigest ? { bindingDigest: reservation.bindingDigest } : {}),
      createdAt: nowIso(),
    });
    await appendLedgerEvent({
      runId: input.runId,
      type: "COST_EXECUTION_STARTED",
      stage: reservation.stage,
      message: "Reserved provider execution callback claimed.",
      data: {
        reservationId: input.reservationId,
        operationId: reservation.operationId,
        provider: reservation.provider,
        model: reservation.model,
        ...(reservation.bindingDigest ? { bindingDigest: reservation.bindingDigest } : {}),
      },
    });
    return {
      reservation: await requireReservation(input.runId, input.reservationId),
      started: true,
    };
  });
}

/**
 * Releases an execution reservation after the provider adapter confirms that no request was submitted.
 *
 * @param input - Identifies the reservation, adapter, and confirmed reason for non-submission.
 * @returns The updated cost reservation summary.
 * @throws SafeExitError If the reservation is not in execution or the adapter does not match the reservation.
 */
export async function releaseDefinitelyNotSentExecution(input: {
  runId: string;
  reservationId: string;
  adapterIdentity: ProviderAdapterIdentity;
  reason: "adapter-validation" | "cancelled-before-send" | "connection-not-opened";
}): Promise<CostReservationSummary> {
  return withCostReservationLock(async () => {
    const reservation = await requireReservation(input.runId, input.reservationId);
    if (reservation.status === "RELEASED") {
      return reservation;
    }
    if (reservation.status !== "EXECUTION_STARTED") {
      throw new SafeExitError(`Cannot release provider execution in state ${reservation.status}.`);
    }
    requireMatchingAdapter(reservation, input.adapterIdentity, "release");
    const reason = `Provider adapter reported ${input.reason} before request submission.`;
    await appendCostReservationEvent({
      eventId: createId("reservation_event"),
      reservationId: input.reservationId,
      runId: input.runId,
      type: "RELEASED",
      reason,
      createdAt: nowIso(),
    });
    await appendLedgerEvent({
      runId: input.runId,
      type: "COST_RELEASED",
      stage: reservation.stage,
      message: "Cost reservation released after confirmed non-submission.",
      data: { reservationId: input.reservationId, reason: input.reason },
    });
    return requireReservation(input.runId, input.reservationId);
  });
}

/**
 * Verifies that an adapter matches the reservation identity for the requested action.
 *
 * @param reservation - The reservation to validate against.
 * @param adapter - The provider adapter identity to compare with the reservation.
 * @param action - The action name included in the rejection message.
 * @throws SafeExitError If the adapter does not match the reservation.
 */
function requireMatchingAdapter(
  reservation: CostReservationSummary,
  adapter: ProviderAdapterIdentity,
  action: string,
): void {
  if (!providerAdapterIdentitiesMatch(reservation, adapter)) {
    throw new SafeExitError(`Blocked: ${action} adapter does not match the reservation.`);
  }
}
