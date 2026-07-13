import { validateArtifactRelativePath } from "./artifactPaths.js";
import type { RunRecord } from "./state.js";

/** Appends an immutable artifact path to the run's ordered evidence registry. */
export function registerRunArtifactPath(run: RunRecord, relativePath: string): RunRecord {
  const validated = validateArtifactRelativePath(relativePath);
  return { ...run, artifacts: [...run.artifacts.filter((path) => path !== validated), validated] };
}

/** Returns the newest registered path matching an evidence family. */
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
