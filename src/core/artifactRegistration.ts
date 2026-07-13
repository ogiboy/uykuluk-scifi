import { validateArtifactRelativePath } from "./artifactPaths.js";
import type { RunRecord } from "./state.js";

/**
 * Registers an artifact path as the newest entry in the run's ordered artifact registry.
 *
 * @param relativePath - The artifact path to validate and register
 * @returns A new run record with the path registered once at the end of the registry
 */
export function registerRunArtifactPath(run: RunRecord, relativePath: string): RunRecord {
  const validated = validateArtifactRelativePath(relativePath);
  return { ...run, artifacts: [...run.artifacts.filter((path) => path !== validated), validated] };
}

/**
 * Finds the most recently registered artifact path matching a predicate.
 *
 * @param predicate - Function that determines whether an artifact path matches.
 * @returns The newest matching artifact path, or `undefined` if no path matches.
 */
export function latestRegisteredArtifactPath(
  run: RunRecord,
  predicate: (relativePath: string) => boolean,
): string | undefined {
  for (let index = run.artifacts.length - 1; index >= 0; index -= 1) {
    const relativePath = run.artifacts[index];
    if (predicate(relativePath)) return relativePath;
  }
  return undefined;
}
