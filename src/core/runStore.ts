import { readdir } from "node:fs/promises";
import { appendLedgerEvent } from "./ledger";
import { RunRecord, RunState, runRecordSchema } from "./state";
import { invariant, SafeExitError } from "./errors";
import { ensureDir, pathExists } from "../utils/fs";
import { readJsonFile, writeJsonFile } from "../utils/json";
import { createId, nowIso } from "../utils/time";
import { isValidRunId, runDir, runsDir, statePath } from "./runPaths";
import { validateArtifactRelativePath } from "./artifactPaths";

export { isValidRunId, runDir, runsDir, statePath, validateRunId } from "./runPaths";

/**
 * Creates a new run record with an initial state.
 *
 * @returns The newly created run record.
 */
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

/**
 * Loads a run from persistent storage by ID.
 *
 * @param runId - The ID of the run to load
 * @returns The loaded run record
 * @throws If the run does not exist or if its persisted state is invalid
 */
export async function loadRun(runId: string): Promise<RunRecord> {
  const target = statePath(runId);
  invariant(await pathExists(target), `Run not found: ${runId}`);
  try {
    const record = validateRunArtifacts(runRecordSchema.parse(await readJsonFile<unknown>(target)));
    if (record.runId !== runId) {
      throw new SafeExitError("Persisted run id does not match its directory.");
    }
    return record;
  } catch (error) {
    throw new SafeExitError(
      `Run state is invalid for ${runId}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Persists a run record to disk, updating its timestamp to the current time.
 *
 * @param record - The run record to save
 */
export async function saveRun(record: RunRecord): Promise<void> {
  const updated = validateRunArtifacts(
    runRecordSchema.parse({
      ...record,
      updatedAt: nowIso(),
    }),
  );
  await writeJsonFile(statePath(record.runId), updated);
}

/**
 * Updates a run's state and records the change in the ledger.
 *
 * @param record - The current run record
 * @param nextState - The target state
 * @param stage - The stage label to associate with the ledger event
 * @returns The updated run record with the new state and current timestamp
 */
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

/**
 * Retrieves all run records.
 *
 * @returns An array of all run records, sorted by creation time descending.
 */
export async function listRuns(): Promise<RunRecord[]> {
  if (!(await pathExists(runsDir()))) {
    return [];
  }
  const entries = await readdir(runsDir(), { withFileTypes: true });
  const records: RunRecord[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !isValidRunId(entry.name)) {
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

/**
 * Validates all artifact relative paths in a run record.
 *
 * @param record - The run record whose artifacts should be validated
 * @returns The input `record` after validating all artifact relative paths
 */
function validateRunArtifacts(record: RunRecord): RunRecord {
  for (const relativePath of record.artifacts) {
    validateArtifactRelativePath(relativePath);
  }
  return record;
}
