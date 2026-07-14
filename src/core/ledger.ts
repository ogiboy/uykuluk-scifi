import { appendFile, readFile } from "node:fs/promises";
import { ensureDir, pathExists } from "../utils/fs.js";
import { createId, nowIso } from "../utils/time.js";
import { SafeExitError } from "./errors.js";
import { runPath } from "./runPaths.js";
import { LedgerEvent, LedgerEventType, ledgerEventSchema } from "./state.js";

/**
 * Constructs the filesystem path to a run's ledger file.
 *
 * @returns The filesystem path to the run's ledger file
 */
export function ledgerPath(runId: string): string {
  return runPath(runId, "ledger.jsonl");
}

/**
 * Creates and appends a ledger event for a run.
 *
 * @returns The created `LedgerEvent`.
 */
export async function appendLedgerEvent(input: {
  runId: string;
  type: LedgerEventType;
  stage: string;
  message: string;
  data?: unknown;
}): Promise<LedgerEvent> {
  const event: LedgerEvent = {
    eventId: createId("evt"),
    runId: input.runId,
    type: input.type,
    stage: input.stage,
    message: input.message,
    data: input.data,
    createdAt: nowIso(),
  };
  const target = ledgerPath(input.runId);
  await ensureDir(runPath(input.runId));
  await appendFile(target, `${JSON.stringify(event)}\n`, "utf8");
  return event;
}

/** Appends a pre-identified event once so a persisted outbox intent can be retried safely. */
export async function appendPreparedLedgerEvent(rawEvent: LedgerEvent): Promise<LedgerEvent> {
  const event = ledgerEventSchema.parse(rawEvent);
  const existing = (await readLedger(event.runId)).find((item) => item.eventId === event.eventId);
  if (existing) {
    if (JSON.stringify(existing) !== JSON.stringify(event)) {
      throw new SafeExitError("Ledger event identity already exists with different evidence.");
    }
    return existing;
  }
  const target = ledgerPath(event.runId);
  await ensureDir(runPath(event.runId));
  await appendFile(target, `${JSON.stringify(event)}\n`, "utf8");
  return event;
}

export async function readLedger(runId: string): Promise<LedgerEvent[]> {
  const target = ledgerPath(runId);
  if (!(await pathExists(target))) {
    return [];
  }
  const text = await readFile(target, "utf8");
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as LedgerEvent);
}
