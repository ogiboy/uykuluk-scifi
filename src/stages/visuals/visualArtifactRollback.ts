import { readFile, rm } from "node:fs/promises";
import { artifactPath } from "../../core/artifacts.js";
import { SafeExitError } from "../../core/errors.js";
import { appendLedgerEvent } from "../../core/ledger.js";
import { pathExists, writeBinaryFile } from "../../utils/fs.js";

type ArtifactSnapshot = Readonly<{ relativePath: string; bytes: Buffer | null }>;

/** Captures exact run-artifact bytes so a failed multi-file visual mutation can restore them. */
export async function captureVisualArtifactRollback(
  runId: string,
  stage: string,
  relativePaths: readonly string[],
): Promise<(failure: unknown) => Promise<void>> {
  const snapshots = await Promise.all(
    Array.from(new Set(relativePaths)).map(async (relativePath): Promise<ArtifactSnapshot> => {
      const target = artifactPath(runId, relativePath);
      return { relativePath, bytes: (await pathExists(target)) ? await readFile(target) : null };
    }),
  );
  return async (failure) => {
    for (const snapshot of snapshots) {
      const target = artifactPath(runId, snapshot.relativePath);
      if (snapshot.bytes) {
        await writeBinaryFile(target, snapshot.bytes);
      } else {
        await rm(target, { force: true });
      }
    }
    await appendLedgerEvent({
      runId,
      type: "ARTIFACT_ROLLBACK",
      stage,
      message: `Restored ${snapshots.length} artifact path(s) after a failed ${stage} mutation.`,
      data: {
        paths: snapshots.map((snapshot) => snapshot.relativePath),
        failure: rollbackFailureEvidence(failure),
      },
    });
  };
}

function rollbackFailureEvidence(
  failure: unknown,
): Readonly<{
  category: "filesystem" | "non-error" | "safe-exit" | "unexpected";
  code?: string;
  name: string;
}> {
  if (!(failure instanceof Error)) return { category: "non-error", name: "NonErrorFailure" };
  const rawCode = (failure as NodeJS.ErrnoException).code;
  const code = rawCode && safeFilesystemFailureCodes.has(rawCode) ? rawCode : undefined;
  const name = failure instanceof SafeExitError ? "SafeExitError" : "Error";
  let category: "filesystem" | "safe-exit" | "unexpected" = "unexpected";
  if (failure instanceof SafeExitError) category = "safe-exit";
  else if (code) category = "filesystem";
  return { category, ...(code ? { code } : {}), name };
}

const safeFilesystemFailureCodes = new Set([
  "EACCES",
  "EBUSY",
  "EISDIR",
  "ELOOP",
  "EMFILE",
  "ENFILE",
  "ENOENT",
  "ENOSPC",
  "ENOTDIR",
  "EPERM",
  "EROFS",
]);
