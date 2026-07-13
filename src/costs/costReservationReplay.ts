import { SafeExitError } from "../core/errors.js";
import type {
  CostReservationEvent,
  CostReservationStatus,
  CostReservationSummary,
} from "./costReservationContracts.js";
import type { ProviderRequestEvidence } from "./providerRequestEvidence.js";

type LifecycleEvent = Exclude<CostReservationEvent, { type: "RESERVED" }>;

const allowedTransitions: Record<CostReservationStatus, CostReservationEvent["type"][]> = {
  RESERVED: ["EXECUTION_STARTED", "RELEASED", "UNCERTAIN"],
  EXECUTION_STARTED: ["SETTLEMENT_PENDING", "RELEASED", "UNCERTAIN"],
  SETTLEMENT_PENDING: ["SETTLED"],
  UNCERTAIN: ["RECONCILED_SETTLED", "RECONCILED_RELEASED"],
  SETTLED: [],
  RELEASED: [],
};

/**
 * Replays cost reservation events into their current summaries.
 *
 * @param events - The events to process in ledger order.
 * @returns The aggregated reservation summaries in their insertion order.
 */
export function summarizeCostReservationEvents(
  events: CostReservationEvent[],
): CostReservationSummary[] {
  const summaries = new Map<string, CostReservationSummary>();
  const eventIds = new Set<string>();
  for (const event of events) {
    recordUniqueEventId(eventIds, event);
    if (event.type === "RESERVED") {
      recordReservation(summaries, event);
      continue;
    }
    const current = requireMatchingReservation(summaries, event);
    summaries.set(event.reservationId, applyReservationEvent(current, event));
  }
  return [...summaries.values()];
}

function recordUniqueEventId(eventIds: Set<string>, event: CostReservationEvent): void {
  if (eventIds.has(event.eventId)) {
    throw new SafeExitError(`Duplicate cost reservation event id: ${event.eventId}.`);
  }
  eventIds.add(event.eventId);
}

function recordReservation(
  summaries: Map<string, CostReservationSummary>,
  event: Extract<CostReservationEvent, { type: "RESERVED" }>,
): void {
  if (summaries.has(event.reservationId)) {
    throw new SafeExitError(`Duplicate reservation event: ${event.reservationId}.`);
  }
  summaries.set(event.reservationId, {
    reservationId: event.reservationId,
    runId: event.runId,
    operationId: event.operationId,
    approvalId: event.approvalId,
    quoteDigest: event.quoteDigest,
    stage: event.stage,
    provider: event.provider,
    model: event.model,
    ...(event.bindingDigest ? { bindingDigest: event.bindingDigest } : {}),
    ...(event.bindingSummary ? { bindingSummary: event.bindingSummary } : {}),
    maxUsdMicros: event.maxUsdMicros,
    status: "RESERVED",
    reservedAt: event.createdAt,
    updatedAt: event.createdAt,
  });
}

function requireMatchingReservation(
  summaries: Map<string, CostReservationSummary>,
  event: LifecycleEvent,
): CostReservationSummary {
  const current = summaries.get(event.reservationId);
  if (current?.runId !== event.runId) {
    throw new SafeExitError(`Reservation event has no matching reserve: ${event.reservationId}.`);
  }
  return current;
}

/**
 * Applies a valid lifecycle event to a cost reservation summary.
 *
 * @param current - The reservation summary before applying the event
 * @param event - The lifecycle event to apply
 * @returns The updated reservation summary
 * @throws `SafeExitError` if the transition is invalid, event identity does not match, or the event type is unsupported
 */
function applyReservationEvent(
  current: CostReservationSummary,
  event: LifecycleEvent,
): CostReservationSummary {
  assertAllowedTransition(current, event);
  const eventType = event.type;
  switch (event.type) {
    case "EXECUTION_STARTED":
      return applyExecutionStarted(current, event);
    case "SETTLEMENT_PENDING":
      return applySettlementPending(current, event);
    case "SETTLED":
    case "RECONCILED_SETTLED":
      return applySettled(current, event);
    case "UNCERTAIN":
    case "RELEASED":
    case "RECONCILED_RELEASED":
      return applyReasonEvent(current, event);
  }
  throw new SafeExitError(`Unsupported cost reservation event: ${eventType}.`);
}

function assertAllowedTransition(current: CostReservationSummary, event: LifecycleEvent): void {
  if (!allowedTransitions[current.status].includes(event.type)) {
    throw new SafeExitError(
      `Invalid cost reservation transition: ${current.status} -> ${event.type}.`,
    );
  }
}

function applyExecutionStarted(
  current: CostReservationSummary,
  event: LifecycleEvent & { type: "EXECUTION_STARTED" },
): CostReservationSummary {
  if (
    (event.provider !== undefined && event.provider !== current.provider) ||
    (event.model !== undefined && event.model !== current.model) ||
    event.bindingDigest !== current.bindingDigest
  ) {
    throw new SafeExitError("Cost execution-start identity does not match its reservation.");
  }
  return {
    ...current,
    status: "EXECUTION_STARTED",
    executionStartedAt: event.createdAt,
    updatedAt: event.createdAt,
  };
}

function applySettlementPending(
  current: CostReservationSummary,
  event: {
    createdAt: string;
    actualUsdMicros: number;
    providerRequestIdHash?: string;
    resultEvidenceDigest?: string;
  },
): CostReservationSummary {
  return {
    ...current,
    status: "SETTLEMENT_PENDING",
    actualUsdMicros: event.actualUsdMicros,
    providerRequestIdHash: event.providerRequestIdHash ?? current.providerRequestIdHash,
    resultEvidenceDigest: event.resultEvidenceDigest ?? current.resultEvidenceDigest,
    updatedAt: event.createdAt,
  };
}

function applySettled(
  current: CostReservationSummary,
  event: {
    createdAt: string;
    actualUsdMicros: number;
    providerRequestIdHash?: string;
    resultEvidenceDigest?: string;
    reason?: string;
  },
): CostReservationSummary {
  return {
    ...current,
    status: "SETTLED",
    actualUsdMicros: event.actualUsdMicros,
    providerRequestIdHash: event.providerRequestIdHash ?? current.providerRequestIdHash,
    resultEvidenceDigest: event.resultEvidenceDigest ?? current.resultEvidenceDigest,
    reason: event.reason ?? current.reason,
    updatedAt: event.createdAt,
  };
}

function applyReasonEvent(
  current: CostReservationSummary,
  event: {
    type: "UNCERTAIN" | "RELEASED" | "RECONCILED_RELEASED";
    createdAt: string;
    providerRequestIdHash?: string;
    requestEvidence?: ProviderRequestEvidence;
    reason: string;
  },
): CostReservationSummary {
  return {
    ...current,
    status: event.type === "UNCERTAIN" ? "UNCERTAIN" : "RELEASED",
    providerRequestIdHash: event.providerRequestIdHash ?? current.providerRequestIdHash,
    requestEvidence: event.requestEvidence ?? current.requestEvidence,
    reason: event.reason,
    updatedAt: event.createdAt,
  };
}
