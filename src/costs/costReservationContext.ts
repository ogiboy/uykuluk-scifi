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

export function requireReservationText(value: string, label: string): void {
  if (!value.trim()) {
    throw new SafeExitError(`Cost reservation ${label} is required.`);
  }
}
