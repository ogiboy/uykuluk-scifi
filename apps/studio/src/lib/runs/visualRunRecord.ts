import { lstat } from "node:fs/promises";
import { loadRunAtProjectRoot } from "../../../../../src/core/runStore";
import type { RunRecord } from "../../../../../src/core/state";
import { studioRunFilePath } from "./runFilePaths";

/** Reads a Studio run record only when its path and persisted schema are both valid. */
export async function readCoreVisualRunRecord(
  root: string,
  runId: string,
): Promise<RunRecord | null> {
  const statePath = studioRunFilePath(root, runId, "state.json");
  if (!statePath) return null;
  try {
    await lstat(statePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  return loadRunAtProjectRoot(root, runId);
}
