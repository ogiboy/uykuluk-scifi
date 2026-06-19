import path from "node:path";
import { SafeExitError } from "./errors";

const RUN_ID_PATTERN = /^run_[A-Za-z0-9][A-Za-z0-9_-]{0,123}$/;

/**
 * Determines if a run ID is valid.
 *
 * @returns `true` if the run ID matches the required format, `false` otherwise.
 */
export function isValidRunId(runId: string): boolean {
  return RUN_ID_PATTERN.test(runId);
}

/**
 * Validates that a run ID matches the expected format.
 *
 * @param runId - The run ID to validate
 * @returns The input `runId` if valid
 * @throws SafeExitError when the run ID is invalid
 */
export function validateRunId(runId: string): string {
  if (!isValidRunId(runId)) {
    throw new SafeExitError(
      "Invalid run id. Expected run_ followed by 1-124 ASCII letters, digits, underscores, or hyphens.",
    );
  }
  return runId;
}

/**
 * Computes the absolute path to the runs directory.
 *
 * @returns The absolute path to the runs directory under the current working directory.
 */
export function runsDir(): string {
  return path.join(process.cwd(), "runs");
}

/**
 * Computes the absolute path to the directory for a specific run.
 *
 * @param runId - The run identifier
 * @returns The absolute path to the run's directory
 */
export function runDir(runId: string): string {
  return path.join(runsDir(), validateRunId(runId));
}

/**
 * Computes the absolute path to a run's state file.
 *
 * @returns The absolute path to the state file.
 */
export function statePath(runId: string): string {
  return path.join(runDir(runId), "state.json");
}
