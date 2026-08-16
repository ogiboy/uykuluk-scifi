import { captureRunArtifactRollback } from "../../core/artifactRollback.js";

/** Captures exact run-artifact bytes so a failed multi-file visual mutation can restore them. */
export async function captureVisualArtifactRollback(
  runId: string,
  stage: string,
  relativePaths: readonly string[],
): Promise<(failure: unknown) => Promise<void>> {
  return captureRunArtifactRollback(runId, stage, relativePaths);
}
