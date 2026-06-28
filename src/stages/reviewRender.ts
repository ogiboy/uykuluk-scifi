import { artifactPath } from "../core/artifacts.js";
import { SafeExitError } from "../core/errors.js";
import { loadRun } from "../core/runStore.js";
import { readJsonFile } from "../utils/json.js";
import {
  draftRenderManifestPath,
  draftRenderManifestSchema,
  type DraftRenderManifest,
  readDraftRenderEvidence,
} from "./renderEvidence.js";

/**
 * Reads the validated draft render manifest for operator review.
 *
 * @param runId - The run identifier whose draft render should be reviewed.
 * @returns The validated draft render manifest.
 */
export async function reviewDraftRender(runId: string): Promise<DraftRenderManifest> {
  const run = await loadRun(runId);
  const evidence = await readDraftRenderEvidence(run);
  if (evidence.status === "missing") {
    throw new SafeExitError(
      `Draft render review is not available yet; run pnpm producer render --run ${run.runId} after explicit render approval.`,
    );
  }
  if (evidence.status === "block") {
    throw new SafeExitError(`Draft render review is blocked: ${evidence.message}`);
  }
  const manifest = draftRenderManifestSchema.parse(
    await readJsonFile(artifactPath(run.runId, draftRenderManifestPath)),
  );
  if (manifest.runId !== run.runId) {
    throw new SafeExitError("Draft render manifest run id does not match this run.");
  }
  return manifest;
}
