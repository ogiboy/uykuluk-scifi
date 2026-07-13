import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { sha256 } from "../utils/hash.js";
import { artifactPath } from "./artifacts.js";
import { SafeExitError } from "./errors.js";
import type { RunRecord } from "./state.js";

/**
 * Computes a revision hash from the exact bytes of the specified registered artifacts.
 *
 * @param run - The run whose artifact registrations and files are validated.
 * @param relativePaths - Relative artifact paths to include in the revision.
 * @returns A SHA-256 revision hash for the artifact paths and their contents.
 */
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

/**
 * Reads an artifact and verifies that its filesystem presence matches run registration.
 *
 * @param run - The run whose artifact registration is checked
 * @param relativePath - The artifact path relative to the run's artifact directory
 * @returns The artifact bytes, or `undefined` when the artifact is absent
 * @throws `SafeExitError` if filesystem presence does not match run registration
 */
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

/**
 * Safely reads a registered artifact file from the filesystem.
 *
 * @param target - The artifact file path to read
 * @returns The file contents, or `undefined` if the path does not exist
 */
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

/**
 * Computes a revision hash for the registered artifacts selected by a predicate.
 *
 * @param run - The run whose registered artifacts are evaluated
 * @param predicate - Selects artifact paths belonging to the artifact family
 * @returns The SHA-256 revision hash of the selected artifacts
 */
export async function registeredArtifactSetRevision(
  run: RunRecord,
  predicate: (relativePath: string) => boolean,
): Promise<string> {
  return registeredArtifactRevision(run, run.artifacts.filter(predicate));
}
