import { readdir } from "node:fs/promises";
import { ensureDir, pathExists } from "../utils/fs.js";
import { readJsonFile, writeJsonFile } from "../utils/json.js";
import { createId, nowIso } from "../utils/time.js";
import { validateArtifactRelativePath } from "./artifactPaths.js";
import { invariant, SafeExitError } from "./errors.js";
import { appendLedgerEvent } from "./ledger.js";
import { isValidRunId, projectRunPath, runDir, runsDir, statePath } from "./runPaths.js";
import { withRunStateLock } from "./runStateLock.js";
import { RunRecord, runRecordSchema, RunState } from "./state.js";

export {
  isValidRunId,
  runDir,
  runPath,
  runsDir,
  runsPath,
  statePath,
  validateRunId,
} from "./runPaths.js";

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
  await appendLedgerEvent({ runId, type: "RUN_CREATED", stage: "init", message: "Run created." });
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
  return loadRunAtProjectRoot(process.cwd(), runId);
}

/**
 * Loads a run beneath an explicit producer project root using canonical path containment.
 *
 * @param projectRoot - Producer project root containing the run state.
 * @param runId - Run identifier whose state is loaded.
 * @returns The validated persisted run record.
 * @throws SafeExitError If the path, persisted state, or artifact registry is invalid.
 */
export async function loadRunAtProjectRoot(projectRoot: string, runId: string): Promise<RunRecord> {
  const target = projectRunPath(projectRoot, runId, "state.json");
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
 * Persists a run record to disk if it has not changed since it was loaded.
 *
 * @param record - The run record to persist
 * @returns The persisted run record with an updated timestamp
 */
export async function saveRun(record: RunRecord): Promise<RunRecord> {
  const validated = validateRunArtifacts(runRecordSchema.parse(record));
  return withRunStateLock(validated.runId, async () => {
    const current = await loadRun(validated.runId);
    return persistRunIfCurrent(validated, current);
  });
}

/**
 * Applies an asynchronous mutation to a run while coordinating state access and persistence.
 *
 * @param runId - The identifier of the run to mutate
 * @param mutation - Produces the updated run and a caller-defined value; set `persist` to `false` to skip persistence
 * @returns The resulting run and caller-defined mutation value
 */
export async function mutateRun<T>(
  runId: string,
  mutation: (
    current: RunRecord,
    context: RunMutationContext,
  ) => Promise<{ run: RunRecord; value: T; persist?: boolean }>,
): Promise<{ run: RunRecord; value: T }> {
  return withRunStateLock(runId, async () => {
    const current = await loadRun(runId);
    const rollbackHandlers: Array<(failure: unknown) => Promise<void> | void> = [];
    try {
      const result = await mutation(current, {
        onRollback(handler) {
          rollbackHandlers.push(handler);
        },
      });
      if (result.persist === false) return { run: current, value: result.value };
      const saved = await persistRunIfCurrent(result.run, current);
      return { run: saved, value: result.value };
    } catch (error) {
      const rollbackErrors: unknown[] = [];
      for (const rollback of rollbackHandlers.reverse()) {
        try {
          await rollback(error);
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError);
        }
      }
      if (rollbackErrors.length > 0) {
        throw new AggregateError(
          [error, ...rollbackErrors],
          "Run mutation failed and its artifact rollback could not be completed.",
          { cause: error },
        );
      }
      throw error;
    }
  });
}

export type RunMutationContext = Readonly<{
  onRollback: (handler: (failure: unknown) => Promise<void> | void) => void;
}>;

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
  const updated = await saveRun({ ...record, state: nextState });
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
 * Persists a run record when it matches the currently stored version.
 *
 * @param record - The run record to persist
 * @param current - The previously loaded current run record
 * @returns The persisted run record with an updated timestamp
 * @throws SafeExitError If the run has changed since `current` was loaded
 */
async function persistRunIfCurrent(record: RunRecord, current: RunRecord): Promise<RunRecord> {
  const validated = validateRunArtifacts(runRecordSchema.parse(record));
  if (validated.runId !== current.runId || validated.updatedAt !== current.updatedAt) {
    throw new SafeExitError(
      "Run state changed during this operation; reload the run before retrying.",
    );
  }
  const previousMs = Date.parse(current.updatedAt);
  const nextMs = Math.max(Date.now(), Number.isFinite(previousMs) ? previousMs + 1 : Date.now());
  const updated = validateRunArtifacts(
    runRecordSchema.parse({ ...validated, updatedAt: new Date(nextMs).toISOString() }),
  );
  await writeJsonFile(statePath(updated.runId), updated);
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
  for (const event of record.pendingLedgerEvents ?? []) {
    if (event.runId !== record.runId) {
      throw new SafeExitError("Pending ledger event identity does not match its owning run.");
    }
  }
  return record;
}
