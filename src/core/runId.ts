export const RUN_ID_ERROR_MESSAGE =
  "Invalid run id. Expected run_ followed by 1-124 ASCII letters, digits, underscores, or hyphens.";

const RUN_ID_PATTERN = /^run_[A-Za-z0-9][A-Za-z0-9_-]{0,123}$/;

/**
 * Determines if a run ID is valid.
 *
 * @param runId - The run ID to validate.
 * @returns `true` when the run ID matches the canonical producer format.
 */
export function isValidRunId(runId: string): boolean {
  return RUN_ID_PATTERN.test(runId);
}
