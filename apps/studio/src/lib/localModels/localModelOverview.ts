import {
  readOverview,
  type LocalModelOperationPreparation,
  type LocalModelOverview,
} from "../../../../../src/localModels/localModelReadiness";

export type StudioLocalModelOverview = LocalModelOverview &
  Readonly<{ preparation?: LocalModelOperationPreparation }>;

/**
 * Reads the local-model owner's operator-safe projection for Settings.
 *
 * This adapter deliberately has no model-install logic. It is the single Studio integration point
 * for the core-owned readiness state and can expose a reviewed preflight once the core projection
 * persists one.
 */
export async function readStudioLocalModelOverview(
  projectRoot: string,
): Promise<StudioLocalModelOverview> {
  return readOverview(projectRoot) as Promise<StudioLocalModelOverview>;
}
