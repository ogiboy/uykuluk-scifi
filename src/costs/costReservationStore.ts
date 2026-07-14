import { appendFile, readFile, readdir } from "node:fs/promises";
import { SafeExitError } from "../core/errors.js";
import { projectRunPath } from "../core/runPaths.js";
import { isValidRunId, runPath, runsDir } from "../core/runStore.js";
import { ensureDir, pathExists } from "../utils/fs.js";
import {
  costReservationEventSchema,
  type CostReservationEvent,
  type CostReservationSummary,
} from "./costReservationContracts.js";
import { summarizeCostReservationEvents } from "./costReservationReplay.js";

export { costReservationEventSchema } from "./costReservationContracts.js";
export type {
  CostReservationEvent,
  CostReservationStatus,
  CostReservationSummary,
} from "./costReservationContracts.js";

/** Returns the validated run's reservation ledger path. */
export function costReservationLedgerPath(runId: string): string {
  return runPath(runId, "costs", "reservations.jsonl");
}

/** Returns the reservation-ledger path beneath an explicit producer project root. */
export function costReservationLedgerPathAtProjectRoot(projectRoot: string, runId: string): string {
  return projectRunPath(projectRoot, runId, "costs", "reservations.jsonl");
}

/** Validates and appends one reservation event without permitting an invalid sequence. */
export async function appendCostReservationEvent(event: CostReservationEvent): Promise<void> {
  const parsed = costReservationEventSchema.parse(event);
  const existing = await readCostReservationEvents(parsed.runId);
  summarizeCostReservationEvents([...existing, parsed]);
  const target = costReservationLedgerPath(parsed.runId);
  await ensureDir(runPath(parsed.runId, "costs"));
  await appendFile(target, `${JSON.stringify(parsed)}\n`, "utf8");
}

/** Reads a run's validated reservation event stream. */
export async function readCostReservationEvents(runId: string): Promise<CostReservationEvent[]> {
  return readCostReservationEventsAtProjectRoot(process.cwd(), runId);
}

/** Reads reservation events beneath an explicit producer project root. */
export async function readCostReservationEventsAtProjectRoot(
  projectRoot: string,
  runId: string,
): Promise<CostReservationEvent[]> {
  const target = costReservationLedgerPathAtProjectRoot(projectRoot, runId);
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

/** Replays one run's reservation events into current summaries. */
export async function readCostReservationSummaries(
  runId: string,
): Promise<CostReservationSummary[]> {
  return summarizeCostReservationEvents(await readCostReservationEvents(runId));
}

/** Replays reservation events beneath an explicit producer project root. */
export async function readCostReservationSummariesAtProjectRoot(
  projectRoot: string,
  runId: string,
): Promise<CostReservationSummary[]> {
  return summarizeCostReservationEvents(
    await readCostReservationEventsAtProjectRoot(projectRoot, runId),
  );
}

/** Aggregates reservation summaries across valid run directories. */
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

/** Reports whether a reservation still counts against a hard budget. */
export function isActiveCostReservation(summary: CostReservationSummary): boolean {
  return ["RESERVED", "EXECUTION_STARTED", "SETTLEMENT_PENDING", "UNCERTAIN"].includes(
    summary.status,
  );
}
