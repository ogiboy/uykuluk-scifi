import path from "node:path";
import { isValidArtifactRelativePath } from "../../../../../src/core/artifactPathRules";
import { isValidRunId } from "../../../../../src/core/runId";

/**
 * Resolves a Studio run file path after validating both the run ID and artifact-relative path.
 *
 * @param root - The project root directory.
 * @param runId - The run identifier.
 * @param relativePath - The artifact-relative path under the run directory.
 * @returns The absolute run file path, or `null` when input is not safe.
 */
export function studioRunFilePath(
  root: string,
  runId: string,
  relativePath: string,
): string | null {
  if (!isValidRunId(runId) || !isValidArtifactRelativePath(relativePath)) {
    return null;
  }
  return path.join(root, "runs", runId, ...relativePath.split("/"));
}
