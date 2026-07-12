import { artifactPath } from "../../core/artifacts.js";
import { pathExists } from "../../utils/fs.js";
import { readJsonFile } from "../../utils/json.js";
import {
  diagnosticSummaryArtifactPaths,
  summarizeRunDiagnosticArtifact,
  type RunDiagnosticSummary,
} from "./runDiagnosticSummaryContracts.js";

export async function readRunDiagnosticSummaries(
  runId: string,
  artifacts: readonly string[],
): Promise<RunDiagnosticSummary[]> {
  const summaries: RunDiagnosticSummary[] = [];
  for (const relativePath of diagnosticSummaryArtifactPaths) {
    if (!artifacts.includes(relativePath)) {
      continue;
    }
    const target = artifactPath(runId, relativePath);
    if (!(await pathExists(target))) {
      continue;
    }
    const summary = summarizeRunDiagnosticArtifact(
      relativePath,
      await readJsonFile<Record<string, unknown>>(target),
    );
    if (summary) {
      summaries.push(summary);
    }
  }
  return summaries;
}
