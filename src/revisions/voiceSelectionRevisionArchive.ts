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

/**
 * Archives voice-selection artifacts and downstream evidence for a revision.
 *
 * @param input - Run state, revision directory, and stage used to record archived artifacts
 * @returns The updated run state, selected source paths, and metadata for archived artifacts and their source bytes
 * @throws `SafeExitError` If archived evidence does not match its source
 */
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

/**
 * Removes the specified voice-selection artifacts from the run state.
 *
 * @param run - The run whose artifacts are removed
 * @param stage - The run stage associated with the artifacts
 * @param sourceArtifacts - The artifact paths to remove
 * @returns The updated run state
 */
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

/**
 * Restores archived voice-selection sources to their original artifact locations and removes the revision directory.
 *
 * @param runId - The run identifier associated with the artifacts
 * @param revisionDir - The revision directory to remove after restoration
 * @param archivedSources - Archived sources and their original locations
 */
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

/**
 * Verifies the paths, sizes, and SHA-256 digests of archived voice-selection artifacts.
 *
 * @param run - The run containing the archived artifacts
 * @param revisionDir - The revision directory containing the archive
 * @param archivedArtifacts - Expected metadata for the archived artifacts
 * @throws `SafeExitError` if an archive path, size, or digest does not match
 */
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
