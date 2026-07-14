import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { sha256 } from "../utils/hash.js";
import { artifactPathAtProjectRoot } from "./artifactPaths.js";
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
  return registeredArtifactRevisionAtProjectRoot(process.cwd(), run, relativePaths);
}

/**
 * Computes an exact registered-artifact revision beneath a selected producer project root.
 *
 * @param projectRoot - Producer project root containing `runs/`.
 * @param run - Run identity and registered artifact paths.
 * @param relativePaths - Registered artifact paths included in the revision.
 * @returns A SHA-256 revision over ordered paths and exact file bytes.
 */
export async function registeredArtifactRevisionAtProjectRoot(
  projectRoot: string,
  run: Pick<RunRecord, "runId" | "artifacts">,
  relativePaths: readonly string[],
): Promise<string> {
  const entries: Array<{ path: string; sha256: string }> = [];
  for (const relativePath of relativePaths) {
    const bytes = await readRegisteredArtifactBytesAtProjectRoot(projectRoot, run, relativePath);
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
  return readRegisteredArtifactBytesAtProjectRoot(process.cwd(), run, relativePath);
}

/**
 * Reads a registered artifact beneath a selected producer project root.
 *
 * @param projectRoot - Producer project root containing `runs/`.
 * @param run - Run identity and artifact registry used for containment verification.
 * @param relativePath - Registered artifact path to read.
 * @returns Artifact bytes, or `undefined` when both registration and file are absent.
 */
export async function readRegisteredArtifactBytesAtProjectRoot(
  projectRoot: string,
  run: Pick<RunRecord, "runId" | "artifacts">,
  relativePath: string,
): Promise<Buffer | undefined> {
  const target = artifactPathAtProjectRoot(projectRoot, run.runId, relativePath);
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
