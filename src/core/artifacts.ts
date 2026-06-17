import path from "node:path";
import { appendLedgerEvent } from "./ledger";
import { runDir } from "./runStore";
import { RunRecord } from "./state";
import { writeJsonFile } from "../utils/json";
import { writeTextFile } from "../utils/fs";

export function artifactPath(runId: string, relativePath: string): string {
  return path.join(runDir(runId), relativePath);
}

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
