import { readFile, rm } from "node:fs/promises";
import { artifactPath } from "../../core/artifacts.js";
import { appendLedgerEvent } from "../../core/ledger.js";
import { pathExists, writeBinaryFile } from "../../utils/fs.js";

type ArtifactSnapshot = Readonly<{ path: string; bytes: Buffer | null }>;

/** Captures exact run-artifact bytes so a failed multi-file visual mutation can restore them. */
export async function captureVisualArtifactRollback(
  runId: string,
  stage: string,
  relativePaths: readonly string[],
): Promise<(failure: unknown) => Promise<void>> {
  const snapshots = await Promise.all(
    Array.from(new Set(relativePaths)).map(async (relativePath): Promise<ArtifactSnapshot> => {
      const target = artifactPath(runId, relativePath);
      return { path: target, bytes: (await pathExists(target)) ? await readFile(target) : null };
    }),
  );
  return async (failure) => {
    for (const snapshot of snapshots) {
      if (snapshot.bytes) {
        await writeBinaryFile(snapshot.path, snapshot.bytes);
      } else {
        await rm(snapshot.path, { force: true });
      }
    }
    await appendLedgerEvent({
      runId,
      type: "ARTIFACT_ROLLBACK",
      stage,
      message: `Restored ${snapshots.length} artifact path(s) after a failed ${stage} mutation.`,
      data: {
        paths: relativePaths,
        failure: failure instanceof Error ? failure.message : String(failure),
      },
    });
  };
}
