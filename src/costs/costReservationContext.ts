import { loadConfig } from "../config/config";
import { SafeExitError } from "../core/errors";
import { appendLedgerEvent } from "../core/ledger";
import { loadRun } from "../core/runStore";
import { createId, nowIso } from "../utils/time";
import { readCostEstimate, validateCostEstimateIntegrity } from "./costEstimate";
import { appendCostEvent, readCostEvents } from "./costLedger";
import {
  appendCostReservationEvent,
  CostReservationSummary,
  readCostReservationSummaries,
} from "./costReservationStore";
import { microsToUsd, usdToMicros } from "./money";

/**
 * Loads an approved quote line for a specified stage of a production-ready run.
 *
 * @param runId - The run identifier
 * @param stage - The stage to retrieve the quote line for
 * @returns An object containing the run, config, approval ID, cost estimate digest, provider, model, and maximum cost in micros
 * @throws If the run is not production-ready, the cost estimate is stale, no matching approval exists, or the quote line is missing or disabled
 */
export async function loadApprovedQuoteLine(runId: string, stage: string) {
  const run = await loadRun(runId);
  if (run.state !== "READY_FOR_MANUAL_PRODUCTION") {
    throw new SafeExitError(
      `Blocked: cost reservation requires state READY_FOR_MANUAL_PRODUCTION; current state is ${run.state}.`,
    );
  }
  const config = await loadConfig();
  const { estimate, digest } = await readCostEstimate(runId);
  const reasons = await validateCostEstimateIntegrity(run, config, estimate);
  if (reasons.length > 0) {
    throw new SafeExitError(`Blocked: approved quote is stale. ${reasons.join(" ")}`);
  }
  const approval = run.approvals.find(
    (item) =>
      item.runId === runId && item.target === "paid-generation-cost" && item.approvedRef === digest,
  );
  if (!approval) {
    throw new SafeExitError("Blocked: exact paid-generation cost approval is missing.");
  }
  const quoteLine = estimate.stages.find((item) => item.stage === stage);
  if (!quoteLine?.enabled || quoteLine.estimatedUsd <= 0) {
    throw new SafeExitError(`Blocked: stage ${stage} has no enabled nonzero quote line.`);
  }
  return {
    run,
    config,
    approvalId: approval.approvalId,
    quoteDigest: digest,
    provider: quoteLine.provider,
    model: quoteLine.model,
    maxUsdMicros: usdToMicros(quoteLine.estimatedUsd),
  };
}

/**
 * Retrieves a cost reservation summary for a run.
 *
 * @throws `SafeExitError` if no reservation exists with the given `reservationId`.
 * @returns The cost reservation summary matching the `reservationId`.
 */
export async function requireReservation(
  runId: string,
  reservationId: string,
): Promise<CostReservationSummary> {
  const reservation = (await readCostReservationSummaries(runId)).find(
    (item) => item.reservationId === reservationId,
  );
  if (!reservation) {
    throw new SafeExitError(`Cost reservation not found: ${reservationId}.`);
  }
  return reservation;
}

/**
 * Marks a cost reservation outcome as uncertain and records the reason.
 *
 * @param reservation - The cost reservation to mark as uncertain
 * @param reason - The reason why the cost outcome is uncertain
 */
export async function appendUncertainEvent(
  reservation: CostReservationSummary,
  reason: string,
): Promise<void> {
  await appendCostReservationEvent({
    eventId: createId("reservation_event"),
    reservationId: reservation.reservationId,
    runId: reservation.runId,
    type: "UNCERTAIN",
    reason,
    createdAt: nowIso(),
  });
  await appendLedgerEvent({
    runId: reservation.runId,
    type: "COST_UNCERTAIN",
    stage: reservation.stage,
    message: "Cost reservation outcome is uncertain.",
    data: { reservationId: reservation.reservationId, reason },
  });
}

/**
 * Ensures a cost event is recorded for the reservation with consistent cost amounts.
 *
 * If a cost event already exists, validates that the reconciled actual cost matches the provided amount. If they differ, throws an error. Otherwise, appends a new cost event with the provided cost and operational metrics.
 *
 * @throws If an existing cost event does not match the provided actual cost.
 */
export async function ensureReservationCostEvent(
  reservation: CostReservationSummary,
  input: {
    actualUsdMicros: number;
    inputTokens?: number;
    outputTokens?: number;
    durationMs?: number;
  },
): Promise<void> {
  const existing = (await readCostEvents(reservation.runId)).find(
    (event) => event.reservationId === reservation.reservationId,
  );
  if (existing) {
    if (usdToMicros(existing.actualUsd ?? existing.estimatedUsd) !== input.actualUsdMicros) {
      throw new SafeExitError(
        "Reservation-linked cost event amount does not match reconciliation.",
      );
    }
    return;
  }
  await appendCostEvent({
    runId: reservation.runId,
    stage: reservation.stage,
    provider: reservation.provider,
    reservationId: reservation.reservationId,
    model: reservation.model,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    estimatedUsd: microsToUsd(reservation.maxUsdMicros),
    actualUsd: microsToUsd(input.actualUsdMicros),
    durationMs: input.durationMs,
    createdAt: nowIso(),
  });
}

/**
 * Validates that a required text field is non-empty after trimming.
 *
 * @param label - The field name or identifier to include in the error message
 * @throws SafeExitError if the value is empty after trimming
 */
export function requireReservationText(value: string, label: string): void {
  if (!value.trim()) {
    throw new SafeExitError(`Cost reservation ${label} is required.`);
  }
}
