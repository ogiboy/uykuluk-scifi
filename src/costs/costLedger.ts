import path from "node:path";
import { appendFile, readFile, readdir } from "node:fs/promises";
import { CostEvent, costEventSchema } from "../core/state";
import { SafeExitError } from "../core/errors";
import { runDir, runsDir } from "../core/runStore";
import { ensureDir, pathExists } from "../utils/fs";

export function costLedgerPath(runId: string): string {
  return path.join(runDir(runId), "costs", "ledger.jsonl");
}

export async function appendCostEvent(event: CostEvent): Promise<void> {
  const parsed = costEventSchema.parse(event);
  const target = costLedgerPath(event.runId);
  await ensureDir(path.dirname(target));
  await appendFile(target, `${JSON.stringify(parsed)}\n`, "utf8");
}

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

export function sumCosts(events: CostEvent[]): number {
  return events.reduce((total, event) => total + (event.actualUsd ?? event.estimatedUsd), 0);
}

export async function readAllCostEvents(): Promise<CostEvent[]> {
  if (!(await pathExists(runsDir()))) {
    return [];
  }
  const entries = await readdir(runsDir(), { withFileTypes: true });
  const all: CostEvent[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    all.push(...(await readCostEvents(entry.name)));
  }
  return all;
}
