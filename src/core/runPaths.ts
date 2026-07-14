import { lstatSync } from "node:fs";
import path from "node:path";
import { SafeExitError } from "./errors.js";
import { isValidRunId, RUN_ID_ERROR_MESSAGE } from "./runId.js";

export { isValidRunId } from "./runId.js";

/**
 * Validates that a run ID matches the expected format.
 *
 * @param runId - The run ID to validate
 * @returns The input `runId` if valid
 * @throws SafeExitError when the run ID is invalid
 */
export function validateRunId(runId: string): string {
  if (!isValidRunId(runId)) {
    throw new SafeExitError(RUN_ID_ERROR_MESSAGE);
  }
  return runId;
}

/**
 * Computes the absolute path to the runs directory.
 *
 * @returns The absolute path to the runs directory under the current working directory.
 */
export function runsDir(): string {
  return runsPath();
}

/**
 * Constructs a symlink-contained path beneath the project runs directory.
 *
 * Existing path components must not be symbolic links. Missing suffixes are allowed for creation.
 */
export function runsPath(...segments: string[]): string {
  return projectRunsPath(process.cwd(), ...segments);
}

/**
 * Constructs a symlink-contained path beneath a specific project runs directory.
 *
 * @param projectRoot - Producer project root containing `runs/`.
 * @param segments - Validated internal path segments below `runs/`.
 * @returns The contained path below the selected project root.
 */
export function projectRunsPath(projectRoot: string, ...segments: string[]): string {
  validateInternalSegments(segments);
  const root = path.join(path.resolve(projectRoot), "runs");
  assertExistingComponentsAreContained(root, segments);
  return path.join(root, ...segments);
}

/**
 * Computes the absolute path to the directory for a specific run.
 *
 * @param runId - The run identifier
 * @returns The absolute path to the run's directory
 */
export function runDir(runId: string): string {
  return runsPath(validateRunId(runId));
}

/** Constructs a symlink-contained internal path beneath a validated run directory. */
export function runPath(runId: string, ...segments: string[]): string {
  return runsPath(validateRunId(runId), ...segments);
}

/** Constructs a symlink-contained run path beneath a specific producer project root. */
export function projectRunPath(projectRoot: string, runId: string, ...segments: string[]): string {
  return projectRunsPath(projectRoot, validateRunId(runId), ...segments);
}

/**
 * Computes the absolute path to a run's state file.
 *
 * @returns The absolute path to the state file.
 */
export function statePath(runId: string): string {
  return runPath(runId, "state.json");
}

function validateInternalSegments(segments: string[]): void {
  if (
    segments.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        path.isAbsolute(segment) ||
        segment.includes("/") ||
        segment.includes("\\"),
    )
  ) {
    throw new SafeExitError("Invalid internal run path segment.");
  }
}

function assertExistingComponentsAreContained(root: string, segments: string[]): void {
  const components = [root];
  for (const segment of segments) {
    components.push(path.join(components.at(-1)!, segment));
  }
  for (let index = 0; index < components.length; index += 1) {
    const component = components[index];
    try {
      const info = lstatSync(component);
      if (info.isSymbolicLink()) {
        throw new SafeExitError(`Blocked symbolic link in run filesystem path: ${component}.`);
      }
      if (index === components.length - 1 && info.isFile() && info.nlink > 1) {
        throw new SafeExitError(`Blocked hard-linked run filesystem path: ${component}.`);
      }
      if (index < components.length - 1 && !info.isDirectory()) {
        throw new SafeExitError(`Blocked non-directory run filesystem path: ${component}.`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return;
      }
      throw error;
    }
  }
}
