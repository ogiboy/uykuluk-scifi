export const studioScriptRevisionStates = [
  "SCRIPT_GENERATED",
  "SCRIPT_REVIEWED",
  "SCRIPT_APPROVED",
] as const;
export const studioPackageArtifactRevisionStates = ["PRODUCTION_PACKAGE_GENERATED"] as const;
const studioRevisionStates = [
  ...studioScriptRevisionStates,
  ...studioPackageArtifactRevisionStates,
] as const;

/**
 * Checks whether Studio should expose script revision controls for a run state.
 *
 * @param state - The persisted core run state.
 * @returns True when CLI/core allows bounded script revision from this state.
 */
export function isStudioScriptRevisionState(state: string): boolean {
  return (studioScriptRevisionStates as readonly string[]).includes(state);
}

/**
 * Checks whether Studio should expose package artifact revision controls for a run state.
 *
 * @param state - The persisted core run state.
 * @returns True when CLI/core allows bounded package artifact revision from this state.
 */
export function isStudioPackageArtifactRevisionState(state: string): boolean {
  return (studioPackageArtifactRevisionStates as readonly string[]).includes(state);
}

/**
 * Checks whether Studio should show any local revision controls for a run state.
 *
 * @param state - The persisted core run state.
 * @returns True when at least one bounded revision action is currently eligible.
 */
export function isStudioRevisionState(state: string): boolean {
  return (studioRevisionStates as readonly string[]).includes(state);
}
