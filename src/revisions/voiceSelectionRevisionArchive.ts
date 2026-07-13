import { createHash } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";

import { readRegisteredArtifactBytes } from "../core/artifactRevision.js";
import { artifactPath, recordRunArtifact, removeRunArtifact } from "../core/artifacts.js";
import { SafeExitError } from "../core/errors.js";
import type { RunRecord } from "../core/state.js";
import { isVoiceSelectionArtifactPath } from "../stages/voice/catalog/voiceAuditionContracts.js";
import { ensureDir, pathExists, writeBinaryFile } from "../utils/fs.js";

export type ArchivedVoiceSelectionArtifact = {
  sourcePath: string;
  archivedPath: string;
  sha256: string;
  bytes: number;
};

export type ArchivedVoiceSelectionSource = {
  sourcePath: string;
  archivedPath: string;
  bytes: Buffer;
};

const downstreamArtifacts = [
  "costs/estimate.json",
  "costs/estimate.md",
  "evidence_bundle.json",
  "evidence_bundle.md",
  "diagnostics/readiness.json",
  "diagnostics/readiness.md",
] as const;

export async function archiveVoiceSelectionRevisionSources(input: {
  run: RunRecord;
  revisionDir: string;
  stage: string;
}): Promise<{
  run: RunRecord;
  sourceArtifacts: string[];
  archivedArtifacts: ArchivedVoiceSelectionArtifact[];
  archivedSources: ArchivedVoiceSelectionSource[];
}> {
  let run = input.run;
  const registeredSelectionPaths = run.artifacts.filter(isVoiceSelectionArtifactPath);
  const sourceArtifacts = Array.from(
    new Set([...registeredSelectionPaths, ...downstreamArtifacts]),
  );
  const archivedArtifacts: ArchivedVoiceSelectionArtifact[] = [];
  const archivedSources: ArchivedVoiceSelectionSource[] = [];
  for (const sourcePath of sourceArtifacts) {
    const sourceBytes = await readRegisteredArtifactBytes(run, sourcePath);
    if (!sourceBytes) continue;
    const archivedPath = `${input.revisionDir}/invalidated/${sourcePath}`;
    await ensureDir(path.dirname(artifactPath(run.runId, archivedPath)));
    await writeBinaryFile(artifactPath(run.runId, archivedPath), sourceBytes);
    const archivedBytes = await readRegisteredArtifactBytes(
      { ...run, artifacts: [...run.artifacts, archivedPath] },
      archivedPath,
    );
    if (!archivedBytes?.equals(sourceBytes)) {
      throw new SafeExitError("Archived voice-selection evidence does not match its source.");
    }
    archivedSources.push({ sourcePath, archivedPath, bytes: sourceBytes });
    archivedArtifacts.push({
      sourcePath,
      archivedPath,
      sha256: createHash("sha256").update(sourceBytes).digest("hex"),
      bytes: sourceBytes.byteLength,
    });
    run = await recordRunArtifact(run, input.stage, archivedPath);
  }
  return { run, sourceArtifacts, archivedArtifacts, archivedSources };
}

export async function removeVoiceSelectionRevisionSources(
  run: RunRecord,
  stage: string,
  sourceArtifacts: readonly string[],
): Promise<RunRecord> {
  let nextRun = run;
  for (const sourcePath of sourceArtifacts) {
    nextRun = await removeRunArtifact(nextRun, stage, sourcePath);
  }
  return nextRun;
}

export async function restoreVoiceSelectionRevisionSources(
  runId: string,
  revisionDir: string,
  archivedSources: readonly ArchivedVoiceSelectionSource[],
): Promise<void> {
  for (const source of archivedSources) {
    if (!(await pathExists(artifactPath(runId, source.sourcePath)))) {
      await writeBinaryFile(artifactPath(runId, source.sourcePath), source.bytes);
    }
  }
  await rm(artifactPath(runId, revisionDir), { recursive: true, force: true }).catch(
    () => undefined,
  );
}

export async function verifyVoiceSelectionRevisionArchives(
  run: RunRecord,
  revisionDir: string,
  archivedArtifacts: readonly ArchivedVoiceSelectionArtifact[],
): Promise<void> {
  for (const archived of archivedArtifacts) {
    const expectedPath = `${revisionDir}/invalidated/${archived.sourcePath}`;
    if (archived.archivedPath !== expectedPath) {
      throw new SafeExitError("Voice-selection revision contains an invalid archive path.");
    }
    const bytes = await readRegisteredArtifactBytes(run, archived.archivedPath);
    if (
      bytes?.byteLength !== archived.bytes ||
      createHash("sha256").update(bytes).digest("hex") !== archived.sha256
    ) {
      throw new SafeExitError("Voice-selection revision archive digest does not match.");
    }
  }
}
