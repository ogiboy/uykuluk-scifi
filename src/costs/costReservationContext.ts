import { loadConfig } from "../config/config.js";
import { SafeExitError } from "../core/errors.js";
import { appendLedgerEvent } from "../core/ledger.js";
import { loadRun } from "../core/runStore.js";
import type { RunState } from "../core/state.js";
import { createId, nowIso } from "../utils/time.js";
import { readCostEstimate, validateCostEstimateIntegrity } from "./costEstimate.js";
import { appendCostEvent, readCostEvents } from "./costLedger.js";
import {
  appendCostReservationEvent,
  CostReservationSummary,
  readCostReservationSummaries,
} from "./costReservationStore.js";
import { microsToUsd, usdToMicros } from "./money.js";
import type { ProviderRequestEvidence } from "./providerRequestEvidence.js";

/**
 * Loads an approved quote line for a specified stage of a production-ready run.
 *
 * @param runId - The production run identifier
 * @param stage - The stage whose quote line to load
 * @returns The run, configuration, approval ID, quote digest, provider, model, optional binding details, and maximum cost in micros
 * @throws SafeExitError If the run is not ready, the quote is stale, approval is missing, or the quote line is unavailable or disabled
 */
export async function loadApprovedQuoteLine(runId: string, stage: string) {
  const run = await loadRun(runId);
  const allowedStates: readonly RunState[] =
    stage === "imageGeneration"
      ? (["PAID_GENERATION_COST_APPROVED", "READY_FOR_MANUAL_PRODUCTION"] as const)
      : (["READY_FOR_MANUAL_PRODUCTION"] as const);
  if (!allowedStates.includes(run.state)) {
    throw new SafeExitError(
      `Blocked: ${stage} cost reservation requires state ${allowedStates.join(" or ")}; current state is ${run.state}.`,
    );
  }
  const config = await loadConfig();
  const { estimate, digest } = await readCostEstimate(runId);
  const reasons = await validateCostEstimateIntegrity(run, config, estimate, digest);
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
    ...(quoteLine.bindingDigest ? { bindingDigest: quoteLine.bindingDigest } : {}),
    ...(quoteLine.bindingSummary ? { bindingSummary: quoteLine.bindingSummary } : {}),
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
 * Marks a cost reservation outcome as uncertain and records supporting request details.
 *
 * @param reservation - The cost reservation to mark as uncertain
 * @param reason - The reason the cost outcome is uncertain
 * @param providerRequestIdHash - Optional hash identifying the provider request
 * @param requestEvidence - Optional evidence about the provider request
 */
export async function appendUncertainEvent(
  reservation: CostReservationSummary,
  reason: string,
  providerRequestIdHash?: string,
  requestEvidence?: ProviderRequestEvidence,
): Promise<void> {
  await appendCostReservationEvent({
    eventId: createId("reservation_event"),
    reservationId: reservation.reservationId,
    runId: reservation.runId,
    type: "UNCERTAIN",
    reason,
    providerRequestIdHash,
    requestEvidence,
    createdAt: nowIso(),
  });
  await appendLedgerEvent({
    runId: reservation.runId,
    type: "COST_UNCERTAIN",
    stage: reservation.stage,
    message: "Cost reservation outcome is uncertain.",
    data: {
      reservationId: reservation.reservationId,
      reason,
      providerRequestIdHash,
      requestEvidence,
    },
  });
}

/**
 * Records the reconciled cost for a reservation and verifies existing records for consistency.
 *
 * Existing records must match both the reconciled cost and result evidence digest. Otherwise,
 * a new cost event is recorded with the provided usage metrics.
 *
 * @throws If an existing cost event's amount or result evidence digest differs from the input.
 */
export async function ensureReservationCostEvent(
  reservation: CostReservationSummary,
  input: {
    actualUsdMicros: number;
    resultEvidenceDigest?: string;
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
    if (existing.resultEvidenceDigest !== input.resultEvidenceDigest) {
      throw new SafeExitError(
        "Reservation-linked cost event result evidence does not match reconciliation.",
      );
    }
    return;
  }
  await appendCostEvent({
    runId: reservation.runId,
    stage: reservation.stage,
    provider: reservation.provider,
    reservationId: reservation.reservationId,
    resultEvidenceDigest: input.resultEvidenceDigest,
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
