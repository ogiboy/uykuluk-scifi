import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  diagnosticSummaryArtifactPaths,
  summarizeRunDiagnosticArtifact,
  type RunDiagnosticSummary,
} from "../../../../src/stages/runDiagnosticSummaryContracts";
import { isValidArtifactRelativePath } from "../../../../src/core/artifactPathRules";
import { isValidRunId } from "../../../../src/core/runId";
import type { RunRecord, StudioRunState } from "./runSummaries";

export type ValidRunRecord = RunRecord & {
  runId: string;
  state: StudioRunState;
};

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
  const record = await readOptionalJson<RunRecord>(root, runId, "state.json");
  if (record?.runId !== runId || !record.state) {
    return null;
  }
  return { ...record, runId: record.runId, state: record.state };
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
    const file = safeRunFilePath(root, runId, relativePath);
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

function safeRunFilePath(root: string, runId: string, relativePath: string): string | null {
  if (!isValidRunId(runId) || !isValidArtifactRelativePath(relativePath)) {
    return null;
  }
  return path.join(root, "runs", runId, ...relativePath.split("/"));
}
