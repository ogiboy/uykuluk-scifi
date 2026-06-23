import { SafeExitError } from "../core/errors";
import { appendLedgerEvent } from "../core/ledger";
import { createId, nowIso } from "../utils/time";
import { requireReservation } from "./costReservationContext";
import { withCostReservationLock } from "./costReservationLock";
import { appendCostReservationEvent, CostReservationSummary } from "./costReservationStore";

type AdapterIdentity = {
  provider: string;
  model?: string;
};

/** Atomically claims one matching reservation for a single callback invocation. */
export async function beginCostReservationExecution(input: {
  runId: string;
  reservationId: string;
  adapterIdentity: AdapterIdentity;
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
      },
    });
    return {
      reservation: await requireReservation(input.runId, input.reservationId),
      started: true,
    };
  });
}

/** Releases a claimed callback only when the matching adapter proves no request was submitted. */
export async function releaseDefinitelyNotSentExecution(input: {
  runId: string;
  reservationId: string;
  adapterIdentity: AdapterIdentity;
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

function requireMatchingAdapter(
  reservation: CostReservationSummary,
  adapter: AdapterIdentity,
  action: string,
): void {
  if (reservation.provider !== adapter.provider || reservation.model !== adapter.model) {
    throw new SafeExitError(`Blocked: ${action} adapter does not match the reservation.`);
  }
}
