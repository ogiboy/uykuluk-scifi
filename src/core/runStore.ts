import path from "node:path";
import { readdir } from "node:fs/promises";
import { appendLedgerEvent } from "./ledger";
import { RunRecord, RunState, runRecordSchema } from "./state";
import { invariant, SafeExitError } from "./errors";
import { ensureDir, pathExists } from "../utils/fs";
import { readJsonFile, writeJsonFile } from "../utils/json";
import { createId, nowIso } from "../utils/time";

export function runsDir(): string {
  return path.join(process.cwd(), "runs");
}

export function runDir(runId: string): string {
  return path.join(runsDir(), runId);
}

export function statePath(runId: string): string {
  return path.join(runDir(runId), "state.json");
}

export async function createRun(): Promise<RunRecord> {
  const runId = createId("run");
  const now = nowIso();
  const record: RunRecord = {
    runId,
    state: "NEW",
    createdAt: now,
    updatedAt: now,
    approvals: [],
    artifacts: [],
    warnings: [],
  };
  await ensureDir(runDir(runId));
  await writeJsonFile(statePath(runId), record);
  await appendLedgerEvent({
    runId,
    type: "RUN_CREATED",
    stage: "init",
    message: "Run created.",
  });
  return record;
}

export async function loadRun(runId: string): Promise<RunRecord> {
  const target = statePath(runId);
  invariant(await pathExists(target), `Run not found: ${runId}`);
  try {
    return runRecordSchema.parse(await readJsonFile<unknown>(target));
  } catch (error) {
    throw new SafeExitError(
      `Run state is invalid for ${runId}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function saveRun(record: RunRecord): Promise<void> {
  const updated = runRecordSchema.parse({
    ...record,
    updatedAt: nowIso(),
  });
  await writeJsonFile(statePath(record.runId), updated);
}

export async function setRunState(
  record: RunRecord,
  nextState: RunState,
  stage: string,
): Promise<RunRecord> {
  const previousState = record.state;
  const updated: RunRecord = {
    ...record,
    state: nextState,
    updatedAt: nowIso(),
  };
  await saveRun(updated);
  await appendLedgerEvent({
    runId: record.runId,
    type: "STATE_CHANGED",
    stage,
    message: `State changed from ${previousState} to ${nextState}.`,
    data: { previousState, nextState },
  });
  return updated;
}

export async function listRuns(): Promise<RunRecord[]> {
  if (!(await pathExists(runsDir()))) {
    return [];
  }
  const entries = await readdir(runsDir(), { withFileTypes: true });
  const records: RunRecord[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    try {
      records.push(await loadRun(entry.name));
    } catch (error) {
      if (!(error instanceof SafeExitError)) {
        throw error;
      }
    }
  }
  return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
