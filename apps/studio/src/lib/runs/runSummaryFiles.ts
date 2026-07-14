import { readdir, readFile } from "node:fs/promises";
import { SafeExitError } from "../../../../../src/core/errors";
import { isValidRunId } from "../../../../../src/core/runId";
import { loadRunAtProjectRoot } from "../../../../../src/core/runStore";
import {
  diagnosticSummaryArtifactPaths,
  summarizeRunDiagnosticArtifact,
  type RunDiagnosticSummary,
} from "../../../../../src/stages/diagnostics/runDiagnosticSummaryContracts";
import { studioRunFilePath } from "./runFilePaths";
import type { RunRecord, StudioRunState } from "./runRecordTypes";

export type ValidRunRecord = RunRecord & { runId: string; state: StudioRunState };

export async function readStudioRunDiagnostics(
  root: string,
  runId: string,
  artifacts: readonly string[],
): Promise<RunDiagnosticSummary[]> {
  const summaries: RunDiagnosticSummary[] = [];
  for (const relativePath of diagnosticSummaryArtifactPaths) {
    if (!artifacts.includes(relativePath)) {
      continue;
    }
    const snapshot = await readOptionalJson<Record<string, unknown>>(root, runId, relativePath);
    const summary = snapshot ? summarizeRunDiagnosticArtifact(relativePath, snapshot) : null;
    if (summary) {
      summaries.push(summary);
    }
  }
  return summaries;
}

export async function readRunRecord(root: string, runId: string): Promise<ValidRunRecord | null> {
  try {
    const record = await loadRunAtProjectRoot(root, runId);
    return { ...record, runId: record.runId, state: record.state };
  } catch (error) {
    if (error instanceof SafeExitError) return null;
    throw error;
  }
}

export async function safeReaddir(
  target: string,
): Promise<Array<{ isDirectory: () => boolean; name: string }>> {
  try {
    return await readdir(target, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export function isRunId(value: string): boolean {
  return isValidRunId(value);
}

async function readOptionalJson<T>(
  root: string,
  runId: string,
  relativePath: string,
): Promise<T | null> {
  try {
    const file = studioRunFilePath(root, runId, relativePath);
    if (!file) {
      return null;
    }
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    return null;
  }
}
