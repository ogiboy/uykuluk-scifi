import path from "node:path";
import { appendFile, readFile } from "node:fs/promises";
import { LedgerEvent, LedgerEventType } from "./state";
import { ensureDir, pathExists } from "../utils/fs";
import { createId, nowIso } from "../utils/time";
import { runDir } from "./runPaths";

export function ledgerPath(runId: string): string {
  return path.join(runDir(runId), "ledger.jsonl");
}

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
  await ensureDir(path.dirname(target));
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
