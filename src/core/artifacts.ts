import { appendLedgerEvent } from "./ledger.js";
import { RunRecord } from "./state.js";
import { writeJsonFile } from "../utils/json.js";
import { writeTextFile } from "../utils/fs.js";
import { artifactPath } from "./artifactPaths.js";

export {
  artifactPath,
  isValidArtifactRelativePath,
  validateArtifactRelativePath,
} from "./artifactPaths.js";

/**
 * Writes a JSON artifact to the run, logs the action to the ledger, and updates the artifact list.
 *
 * @param run - The run record to update
 * @param stage - The run stage identifier
 * @param relativePath - The relative path where the artifact will be stored
 * @param value - The value to serialize as JSON
 * @returns The updated run record with the artifact added
 */
export async function writeRunJson(
  run: RunRecord,
  stage: string,
  relativePath: string,
  value: unknown,
): Promise<RunRecord> {
  await writeJsonFile(artifactPath(run.runId, relativePath), value);
  await appendLedgerEvent({
    runId: run.runId,
    type: "ARTIFACT_WRITTEN",
    stage,
    message: `Wrote ${relativePath}.`,
    data: { path: relativePath },
  });
  return addArtifact(run, relativePath);
}

export async function writeRunText(
  run: RunRecord,
  stage: string,
  relativePath: string,
  value: string,
): Promise<RunRecord> {
  await writeTextFile(
    artifactPath(run.runId, relativePath),
    value.endsWith("\n") ? value : `${value}\n`,
  );
  await appendLedgerEvent({
    runId: run.runId,
    type: "ARTIFACT_WRITTEN",
    stage,
    message: `Wrote ${relativePath}.`,
    data: { path: relativePath },
  });
  return addArtifact(run, relativePath);
}

function addArtifact(run: RunRecord, relativePath: string): RunRecord {
  return {
    ...run,
    artifacts: Array.from(new Set([...run.artifacts, relativePath])),
  };
}
