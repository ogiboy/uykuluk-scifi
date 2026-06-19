import path from "node:path";
import { appendFile, readFile, readdir } from "node:fs/promises";
import { z } from "zod";
import { SafeExitError } from "../core/errors";
import { isValidRunId, runDir, runsDir } from "../core/runStore";
import { ensureDir, pathExists } from "../utils/fs";

const reservationBaseSchema = z.object({
  eventId: z.string().min(1),
  reservationId: z.string().min(1),
  runId: z.string().min(1),
  createdAt: z.string().datetime(),
});

const reservedEventSchema = reservationBaseSchema
  .extend({
    type: z.literal("RESERVED"),
    operationId: z.string().min(1),
    approvalId: z.string().min(1),
    quoteDigest: z.string().regex(/^[a-f0-9]{64}$/),
    stage: z.string().min(1),
    provider: z.string().min(1),
    model: z.string().min(1).optional(),
    maxUsdMicros: z.number().int().nonnegative(),
  })
  .strict();

const settlementEventSchema = reservationBaseSchema
  .extend({
    type: z.enum(["SETTLEMENT_PENDING", "SETTLED"]),
    actualUsdMicros: z.number().int().nonnegative(),
  })
  .strict();

const reasonEventSchema = reservationBaseSchema
  .extend({
    type: z.enum(["RELEASED", "UNCERTAIN", "RECONCILED_RELEASED"]),
    reason: z.string().min(1),
  })
  .strict();

const reconciledSettledEventSchema = reservationBaseSchema
  .extend({
    type: z.literal("RECONCILED_SETTLED"),
    actualUsdMicros: z.number().int().nonnegative(),
    reason: z.string().min(1),
  })
  .strict();

export const costReservationEventSchema = z.discriminatedUnion("type", [
  reservedEventSchema,
  settlementEventSchema,
  reasonEventSchema,
  reconciledSettledEventSchema,
]);

export type CostReservationEvent = z.infer<typeof costReservationEventSchema>;
export type CostReservationStatus =
  | "RESERVED"
  | "SETTLEMENT_PENDING"
  | "SETTLED"
  | "RELEASED"
  | "UNCERTAIN";

export type CostReservationSummary = {
  reservationId: string;
  runId: string;
  operationId: string;
  approvalId: string;
  quoteDigest: string;
  stage: string;
  provider: string;
  model?: string;
  maxUsdMicros: number;
  status: CostReservationStatus;
  actualUsdMicros?: number;
  reason?: string;
  reservedAt: string;
  updatedAt: string;
};

/**
 * Computes the ledger file path for a run's cost reservations.
 *
 * @returns The path to the cost reservations JSONL file.
 */
export function costReservationLedgerPath(runId: string): string {
  return path.join(runDir(runId), "costs", "reservations.jsonl");
}

/**
 * Appends a cost reservation event to the ledger for its run.
 *
 * Validates that the event conforms to the schema and that the resulting event sequence maintains valid state transitions.
 */
export async function appendCostReservationEvent(event: CostReservationEvent): Promise<void> {
  const parsed = costReservationEventSchema.parse(event);
  const existing = await readCostReservationEvents(parsed.runId);
  summarizeCostReservationEvents([...existing, parsed]);
  const target = costReservationLedgerPath(parsed.runId);
  await ensureDir(path.dirname(target));
  await appendFile(target, `${JSON.stringify(parsed)}\n`, "utf8");
}

/**
 * Reads and validates the cost reservation event ledger for a run.
 *
 * @param runId - The run identifier
 * @returns An array of cost reservation events for the run, or an empty array if no ledger exists
 * @throws SafeExitError if the ledger exists but is invalid or contains events from a different run
 */
export async function readCostReservationEvents(runId: string): Promise<CostReservationEvent[]> {
  const target = costReservationLedgerPath(runId);
  if (!(await pathExists(target))) {
    return [];
  }
  const text = await readFile(target, "utf8");
  try {
    const events = text
      .split("\n")
      .filter(Boolean)
      .map((line) => costReservationEventSchema.parse(JSON.parse(line) as unknown));
    if (events.some((event) => event.runId !== runId)) {
      throw new SafeExitError(`Cost reservation ledger contains a foreign run id.`);
    }
    summarizeCostReservationEvents(events);
    return events;
  } catch (error) {
    throw new SafeExitError(
      `Cost reservation ledger is invalid for ${runId}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Retrieves cost reservation summaries for a run.
 *
 * @param runId - The run ID
 * @returns An array of cost reservation summaries for the given run
 */
export async function readCostReservationSummaries(
  runId: string,
): Promise<CostReservationSummary[]> {
  return summarizeCostReservationEvents(await readCostReservationEvents(runId));
}

/**
 * Aggregates cost reservation summaries from all valid runs.
 *
 * @returns An array of cost reservation summaries from all valid runs; empty array if the runs directory does not exist.
 */
export async function readAllCostReservationSummaries(): Promise<CostReservationSummary[]> {
  if (!(await pathExists(runsDir()))) {
    return [];
  }
  const entries = await readdir(runsDir(), { withFileTypes: true });
  const summaries: CostReservationSummary[] = [];
  for (const entry of entries) {
    if (entry.isDirectory() && isValidRunId(entry.name)) {
      summaries.push(...(await readCostReservationSummaries(entry.name)));
    }
  }
  return summaries;
}

/**
 * Determines if a cost reservation is in an active status.
 *
 * @returns `true` if the reservation status is `RESERVED`, `SETTLEMENT_PENDING`, or `UNCERTAIN`, `false` otherwise.
 */
export function isActiveCostReservation(summary: CostReservationSummary): boolean {
  return ["RESERVED", "SETTLEMENT_PENDING", "UNCERTAIN"].includes(summary.status);
}

/**
 * Constructs reservation summaries by replaying events and validating the ledger sequence.
 *
 * @param events - The cost reservation events to summarize
 * @returns An array of reservation summaries derived from the events
 * @throws SafeExitError if the event sequence is invalid (duplicate event IDs, missing reservations, or disallowed state transitions)
 */
function summarizeCostReservationEvents(events: CostReservationEvent[]): CostReservationSummary[] {
  const summaries = new Map<string, CostReservationSummary>();
  const eventIds = new Set<string>();
  for (const event of events) {
    if (eventIds.has(event.eventId)) {
      throw new SafeExitError(`Duplicate cost reservation event id: ${event.eventId}.`);
    }
    eventIds.add(event.eventId);
    if (event.type === "RESERVED") {
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
        maxUsdMicros: event.maxUsdMicros,
        status: "RESERVED",
        reservedAt: event.createdAt,
        updatedAt: event.createdAt,
      });
      continue;
    }
    const current = summaries.get(event.reservationId);
    if (!current || current.runId !== event.runId) {
      throw new SafeExitError(`Reservation event has no matching reserve: ${event.reservationId}.`);
    }
    summaries.set(event.reservationId, applyReservationEvent(current, event));
  }
  return [...summaries.values()];
}

/**
 * Applies a cost reservation event to an existing summary, updating its state and validating allowed transitions.
 *
 * @returns The updated cost reservation summary with applied event changes
 * @throws SafeExitError if the event type is not allowed for the current status
 */
function applyReservationEvent(
  current: CostReservationSummary,
  event: Exclude<CostReservationEvent, { type: "RESERVED" }>,
): CostReservationSummary {
  const allowed: Record<CostReservationStatus, CostReservationEvent["type"][]> = {
    RESERVED: ["SETTLEMENT_PENDING", "RELEASED", "UNCERTAIN"],
    SETTLEMENT_PENDING: ["SETTLED"],
    UNCERTAIN: ["RECONCILED_SETTLED", "RECONCILED_RELEASED"],
    SETTLED: [],
    RELEASED: [],
  };
  if (!allowed[current.status].includes(event.type)) {
    throw new SafeExitError(
      `Invalid cost reservation transition: ${current.status} -> ${event.type}.`,
    );
  }
  if (event.type === "SETTLEMENT_PENDING") {
    return {
      ...current,
      status: "SETTLEMENT_PENDING",
      actualUsdMicros: event.actualUsdMicros,
      updatedAt: event.createdAt,
    };
  }
  if (event.type === "SETTLED" || event.type === "RECONCILED_SETTLED") {
    return {
      ...current,
      status: "SETTLED",
      actualUsdMicros: event.actualUsdMicros,
      reason: "reason" in event ? event.reason : current.reason,
      updatedAt: event.createdAt,
    };
  }
  if (
    event.type === "UNCERTAIN" ||
    event.type === "RELEASED" ||
    event.type === "RECONCILED_RELEASED"
  ) {
    return {
      ...current,
      status: event.type === "UNCERTAIN" ? "UNCERTAIN" : "RELEASED",
      reason: event.reason,
      updatedAt: event.createdAt,
    };
  }
  throw new SafeExitError(`Unsupported cost reservation event: ${event.type}.`);
}
