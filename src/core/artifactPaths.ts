import { isValidArtifactRelativePath } from "./artifactPathRules.js";
import { SafeExitError } from "./errors.js";
import { projectRunPath, runPath } from "./runPaths.js";

export { isValidArtifactRelativePath } from "./artifactPathRules.js";

/**
 * Ensures a relative path meets artifact path requirements.
 *
 * @param relativePath - The relative path to validate
 * @returns The original `relativePath` if valid
 * @throws `SafeExitError` if the path is invalid
 */
export function validateArtifactRelativePath(relativePath: string): string {
  if (!isValidArtifactRelativePath(relativePath)) {
    throw new SafeExitError(
      "Invalid artifact path. Expected a 1-512 character relative path of safe forward-slash-separated segments.",
    );
  }
  return relativePath;
}

/**
 * Constructs an artifact path for a given run.
 *
 * @returns The artifact path
 * @throws SafeExitError if the relative path is invalid
 */
export function artifactPath(runId: string, relativePath: string): string {
  const validated = validateArtifactRelativePath(relativePath);
  return runPath(runId, ...validated.split("/"));
}

/**
 * Constructs a validated artifact path beneath a specific producer project root.
 *
 * @param projectRoot - Producer project root containing `runs/`.
 * @param runId - Run identifier owning the artifact.
 * @param relativePath - Canonical artifact-relative path.
 * @returns The symlink-contained absolute artifact path.
 */
export function artifactPathAtProjectRoot(
  projectRoot: string,
  runId: string,
  relativePath: string,
): string {
  const validated = validateArtifactRelativePath(relativePath);
  return projectRunPath(projectRoot, runId, ...validated.split("/"));
}
