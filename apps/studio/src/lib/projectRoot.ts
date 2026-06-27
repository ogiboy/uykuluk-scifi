import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Resolves the project root directory.
 *
 * @returns The path from `UYKULUK_SCIFI_ROOT`, a detected repository root, or the current working directory.
 */
export function projectRoot(): string {
  if (process.env.UYKULUK_SCIFI_ROOT) {
    return process.env.UYKULUK_SCIFI_ROOT;
  }

  const cwd = process.cwd();
  return rootFromStudioPath(cwd) ?? findRepositoryRoot(cwd) ?? cwd;
}

/**
 * Resolves a repository root when the current path is inside `apps/studio`.
 *
 * @param cwd - The current working directory.
 * @returns The repository root, or `null` when the path is not under `apps/studio`.
 */
function rootFromStudioPath(cwd: string): string | null {
  const resolved = path.resolve(cwd);
  const parts = resolved.split(path.sep);
  for (let index = 0; index < parts.length - 1; index += 1) {
    if (parts[index] === "apps" && parts[index + 1] === "studio") {
      return parts.slice(0, index).join(path.sep) || path.sep;
    }
  }
  return null;
}

/**
 * Walks upward until repository markers identify the project root.
 *
 * @param cwd - The directory where the search starts.
 * @returns The repository root, or `null` when no marker is found.
 */
function findRepositoryRoot(cwd: string): string | null {
  let current = path.resolve(cwd);
  while (true) {
    if (isProjectRoot(current)) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

/**
 * Checks for repository markers that are stable in local and CI runs.
 *
 * @param candidate - The candidate project root.
 * @returns `true` when the candidate looks like the producer repository root.
 */
function isProjectRoot(candidate: string): boolean {
  return (
    existsSync(path.join(candidate, "package.json")) &&
    existsSync(path.join(candidate, "apps", "studio", "package.json"))
  );
}
