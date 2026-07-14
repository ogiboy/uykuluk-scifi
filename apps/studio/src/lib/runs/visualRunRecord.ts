import { readFile } from "node:fs/promises";
import { runRecordSchema, type RunRecord } from "../../../../../src/core/state";
import { studioRunFilePath } from "./runFilePaths";

/** Reads a Studio run record only when its path and persisted schema are both valid. */
export async function readCoreVisualRunRecord(
  root: string,
  runId: string,
): Promise<RunRecord | null> {
  const statePath = studioRunFilePath(root, runId, "state.json");
  if (!statePath) return null;
  try {
    return runRecordSchema.parse(JSON.parse(await readFile(statePath, "utf8")) as unknown);
  } catch {
    return null;
  }
}
