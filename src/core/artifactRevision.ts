import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { sha256 } from "../utils/hash.js";
import { artifactPath } from "./artifacts.js";
import { SafeExitError } from "./errors.js";
import type { RunRecord } from "./state.js";

/** Hashes exact registered artifact bytes and rejects file/state registration mismatches. */
export async function registeredArtifactRevision(
  run: RunRecord,
  relativePaths: readonly string[],
): Promise<string> {
  const entries: Array<{ path: string; sha256: string }> = [];
  for (const relativePath of relativePaths) {
    const target = artifactPath(run.runId, relativePath);
    const registered = run.artifacts.includes(relativePath);
    const bytes = await readContainedArtifact(target);
    const exists = bytes !== undefined;
    if (registered !== exists) {
      throw new SafeExitError(
        `Run artifact registration does not match local evidence: ${relativePath}.`,
      );
    }
    if (bytes) {
      entries.push({
        path: relativePath,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      });
    }
  }
  return sha256(JSON.stringify(entries));
}

/** Reads one optional artifact while requiring filesystem presence to match run registration. */
export async function readRegisteredArtifactBytes(
  run: RunRecord,
  relativePath: string,
): Promise<Buffer | undefined> {
  const target = artifactPath(run.runId, relativePath);
  const bytes = await readContainedArtifact(target);
  if (run.artifacts.includes(relativePath) !== (bytes !== undefined)) {
    throw new SafeExitError(
      `Run artifact registration does not match local evidence: ${relativePath}.`,
    );
  }
  return bytes;
}

async function readContainedArtifact(target: string): Promise<Buffer | undefined> {
  let handle;
  try {
    handle = await open(target, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const info = await handle.stat();
    if (!info.isFile() || info.nlink !== 1) {
      throw new SafeExitError("Registered run artifact path is not a safe regular file.");
    }
    return await handle.readFile();
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return undefined;
    if (code === "ELOOP") {
      throw new SafeExitError("Registered run artifact path must not be a symbolic link.");
    }
    throw error;
  } finally {
    await handle?.close();
  }
}

/** Hashes the ordered registered members of an append-only artifact family. */
export async function registeredArtifactSetRevision(
  run: RunRecord,
  predicate: (relativePath: string) => boolean,
): Promise<string> {
  return registeredArtifactRevision(run, run.artifacts.filter(predicate));
}
