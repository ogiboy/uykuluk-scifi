import {
  readOverview,
  type LocalModelOperationPreparation,
  type LocalModelOverview,
} from "../../../../../src/localModels/localModelReadiness";

export type StudioLocalModelOverview = LocalModelOverview &
  Readonly<{ preparation?: LocalModelOperationPreparation }>;

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
