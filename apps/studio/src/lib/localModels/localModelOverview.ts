import {
  localModelCatalog,
  localModelStatePaths,
  readOverview,
  type LocalModelOperationPreparation,
  type LocalModelOverview,
} from "../../../../../src/localModels/localModelReadiness";

export type StudioLocalModelOverview = LocalModelOverview &
  Readonly<{ preparation?: LocalModelOperationPreparation; readError?: string }>;

/**
 * Reads the local-model readiness overview for Studio Settings.
 *
 * @param projectRoot - The project root used to locate local-model state
 * @returns The operator-safe local-model overview, including preparation details when available
 */
export async function readStudioLocalModelOverview(
  projectRoot: string,
): Promise<StudioLocalModelOverview> {
  return readOverview(projectRoot) as Promise<StudioLocalModelOverview>;
}

/** Builds an operator-visible fallback when persisted local-model state cannot be read. */
export function unavailableStudioLocalModelOverview(projectRoot: string): StudioLocalModelOverview {
  const readError = "Local model readiness records could not be read safely.";
  return {
    catalog: Object.values(localModelCatalog),
    readiness: "failed",
    recoveryAvailable: false,
    runtimePath: localModelStatePaths(projectRoot).runtimePath,
    modelPath: localModelStatePaths(projectRoot).modelPath,
    nextAction: readError,
    readError,
  };
}
