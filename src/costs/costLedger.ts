import { appendFile, readFile, readdir } from "node:fs/promises";
import { CostEvent, costEventSchema } from "../core/state.js";
import { SafeExitError } from "../core/errors.js";
import { isValidRunId, runPath, runsDir } from "../core/runStore.js";
import { ensureDir, pathExists } from "../utils/fs.js";

/**
 * Constructs the filesystem path to a cost ledger file for a given run.
 *
 * @param runId - The run identifier
 * @returns The filesystem path to the cost ledger file
 */
export function costLedgerPath(runId: string): string {
  return runPath(runId, "costs", "ledger.jsonl");
}

/**
 * Validates and appends a cost event to the run's cost ledger.
 */
export async function appendCostEvent(event: CostEvent): Promise<void> {
  const parsed = costEventSchema.parse(event);
  const target = costLedgerPath(event.runId);
  await ensureDir(runPath(event.runId, "costs"));
  await appendFile(target, `${JSON.stringify(parsed)}\n`, "utf8");
}

/**
 * Reads and validates cost events for a specific run from its ledger file.
 *
 * @returns An array of validated `CostEvent` objects for the run. If the ledger file does not exist, an empty array.
 * @throws SafeExitError if the ledger file is invalid, cannot be parsed, or contains events from a different run.
 */
export async function readCostEvents(runId: string): Promise<CostEvent[]> {
  const target = costLedgerPath(runId);
  if (!(await pathExists(target))) {
    return [];
  }
  const text = await readFile(target, "utf8");
  try {
    const events = text
      .split("\n")
      .filter(Boolean)
      .map((line) => costEventSchema.parse(JSON.parse(line) as unknown));
    if (events.some((event) => event.runId !== runId)) {
      throw new SafeExitError(`Cost ledger contains a foreign run id for ${runId}.`);
    }
    return events;
  } catch (error) {
    throw new SafeExitError(
      `Cost ledger is invalid for ${runId}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Calculates the total cost from a list of cost events.
 *
 * @returns The sum of the actual or estimated cost of each event.
 */
export function sumCosts(events: CostEvent[]): number {
  return events.reduce((total, event) => total + (event.actualUsd ?? event.estimatedUsd), 0);
}

/**
 * Aggregates cost events from all valid runs.
 *
 * @returns All cost events from valid runs.
 */
export async function readAllCostEvents(): Promise<CostEvent[]> {
  if (!(await pathExists(runsDir()))) {
    return [];
  }
  const entries = await readdir(runsDir(), { withFileTypes: true });
  const all: CostEvent[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !isValidRunId(entry.name)) {
      continue;
    }
    all.push(...(await readCostEvents(entry.name)));
  }
  return all;
}
