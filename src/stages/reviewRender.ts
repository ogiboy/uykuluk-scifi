import { SafeExitError } from "../core/errors.js";
import { loadRun } from "../core/runStore.js";
import { type DraftRenderManifest, readDraftRenderValidation } from "./renderEvidence.js";

/**
 * Reads the validated draft render manifest for operator review.
 *
 * @param runId - The run identifier whose draft render should be reviewed.
 * @returns The validated draft render manifest.
 */
export async function reviewDraftRender(runId: string): Promise<DraftRenderManifest> {
  const run = await loadRun(runId);
  const result = await readDraftRenderValidation(run);
  if (result.status === "missing") {
    throw new SafeExitError(
      `Draft render review is not available yet; run pnpm producer render --run ${run.runId} after explicit render approval.`,
    );
  }
  if (result.status === "block") {
    throw new SafeExitError(`Draft render review is blocked: ${result.message}`);
  }
  return result.manifest;
}
