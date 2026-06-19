import { SafeExitError } from "../core/errors";
import { appendLedgerEvent } from "../core/ledger";
import { createId, nowIso } from "../utils/time";
import {
  appendUncertainEvent,
  ensureReservationCostEvent,
  requireReservation,
  requireReservationText,
} from "./costReservationContext";
import { withCostReservationLock } from "./costReservationLock";
import { appendCostReservationEvent, CostReservationSummary } from "./costReservationStore";

/**
 * Finalizes a reservation's cost after a provider charge is known.
 *
 * @param input.actualUsdMicros - The actual cost charged by the provider, in USD micros
 * @throws {SafeExitError} If the reservation cannot be settled due to its status or if the actual cost exceeds the approved cap.
 * @returns The updated reservation.
 */
export async function settleCostReservation(input: {
  runId: string;
  reservationId: string;
  actualUsdMicros: number;
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number;
}): Promise<CostReservationSummary> {
  return withCostReservationLock(async () => {
    let reservation = await requireReservation(input.runId, input.reservationId);
    if (reservation.status === "SETTLED") {
      if (reservation.actualUsdMicros !== input.actualUsdMicros) {
        throw new SafeExitError("Settled reservation amount does not match the retry.");
      }
      return reservation;
    }
    if (reservation.status === "UNCERTAIN") {
      throw new SafeExitError("Uncertain reservation requires explicit reconciliation.");
    }
    if (reservation.status === "RELEASED") {
      throw new SafeExitError("Released reservation cannot be settled.");
    }
    if (input.actualUsdMicros > reservation.maxUsdMicros) {
      await appendUncertainEvent(
        reservation,
        `Actual charge ${input.actualUsdMicros} micros exceeds approved cap ${reservation.maxUsdMicros}.`,
      );
      throw new SafeExitError(
        "Actual provider charge exceeds the approved cap; outcome is uncertain.",
      );
    }
    if (reservation.status === "RESERVED") {
      await appendCostReservationEvent({
        eventId: createId("reservation_event"),
        reservationId: input.reservationId,
        runId: input.runId,
        type: "SETTLEMENT_PENDING",
        actualUsdMicros: input.actualUsdMicros,
        createdAt: nowIso(),
      });
      reservation = await requireReservation(input.runId, input.reservationId);
    }
    if (reservation.actualUsdMicros !== input.actualUsdMicros) {
      throw new SafeExitError("Pending settlement amount does not match the retry.");
    }
    await ensureReservationCostEvent(reservation, input);
    await appendCostReservationEvent({
      eventId: createId("reservation_event"),
      reservationId: input.reservationId,
      runId: input.runId,
      type: "SETTLED",
      actualUsdMicros: input.actualUsdMicros,
      createdAt: nowIso(),
    });
    await appendLedgerEvent({
      runId: input.runId,
      type: "COST_SETTLED",
      stage: reservation.stage,
      message: "Cost reservation settled.",
      data: { reservationId: input.reservationId, actualUsdMicros: input.actualUsdMicros },
    });
    return requireReservation(input.runId, input.reservationId);
  });
}

/**
 * Resolves an uncertain cost reservation by recording its final outcome as settled or released.
 *
 * @returns The updated reservation summary
 * @throws {SafeExitError} If the reservation is not in UNCERTAIN status
 */
export async function reconcileCostReservation(
  input:
    | {
        runId: string;
        reservationId: string;
        outcome: "settled";
        actualUsdMicros: number;
        reason: string;
      }
    | {
        runId: string;
        reservationId: string;
        outcome: "released";
        reason: string;
      },
): Promise<CostReservationSummary> {
  requireReservationText(input.reason, "reconciliation reason");
  return withCostReservationLock(async () => {
    const reservation = await requireReservation(input.runId, input.reservationId);
    if (reservation.status !== "UNCERTAIN") {
      throw new SafeExitError(`Reservation ${input.reservationId} is not uncertain.`);
    }
    if (input.outcome === "settled") {
      await ensureReservationCostEvent(reservation, input);
      await appendCostReservationEvent({
        eventId: createId("reservation_event"),
        reservationId: input.reservationId,
        runId: input.runId,
        type: "RECONCILED_SETTLED",
        actualUsdMicros: input.actualUsdMicros,
        reason: input.reason,
        createdAt: nowIso(),
      });
    } else {
      await appendCostReservationEvent({
        eventId: createId("reservation_event"),
        reservationId: input.reservationId,
        runId: input.runId,
        type: "RECONCILED_RELEASED",
        reason: input.reason,
        createdAt: nowIso(),
      });
    }
    await appendLedgerEvent({
      runId: input.runId,
      type: "COST_RECONCILED",
      stage: reservation.stage,
      message: `Cost reservation reconciled as ${input.outcome}.`,
      data: { reservationId: input.reservationId, reason: input.reason },
    });
    return requireReservation(input.runId, input.reservationId);
  });
}
