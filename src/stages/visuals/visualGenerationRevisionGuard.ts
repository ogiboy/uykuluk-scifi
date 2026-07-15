import { SafeExitError } from "../../core/errors.js";
import { appendLedgerEvent } from "../../core/ledger.js";
import type { VisualScene } from "./visualContracts.js";
import { hostedVisualGenerationPlanPath } from "./visualGenerationPlanContracts.js";

export async function hostedVisualRevisionBlocked(
  _runId: string,
  message: string,
): Promise<SafeExitError> {
  return new SafeExitError(message);
}

export function hostedVisualRevisionPaths(revisionId: string): {
  archivedPlanPath: string;
  revisionPath: string;
} {
  const revisionDir = `revisions/hosted-visual/${revisionId}`;
  return {
    archivedPlanPath: `${revisionDir}/invalidated/${hostedVisualGenerationPlanPath}`,
    revisionPath: `${revisionDir}/revision.json`,
  };
}

export async function requireRejectedHostedVisualScenes(
  scenes: readonly VisualScene[],
  requestedSceneIndexes: readonly number[],
): Promise<VisualScene[]> {
  const rejectedScenes: VisualScene[] = [];
  for (const sceneIndex of requestedSceneIndexes) {
    const scene = scenes.find((item) => item.sceneIndex === sceneIndex);
    if (
      !scene ||
      scene.decision?.status !== "rejected" ||
      scene.decision.revision !== scene.activeRevision
    ) {
      throw await hostedVisualRevisionBlocked(
        "",
        `Hosted visual scene ${sceneIndex} must reject its active revision before regeneration.`,
      );
    }
    rejectedScenes.push(scene);
  }
  return rejectedScenes;
}

export async function requireUniqueHostedVisualSceneIndexes(
  sceneIndexes: readonly number[],
): Promise<number[]> {
  const requested = Array.from(new Set(sceneIndexes)).sort((left, right) => left - right);
  if (requested.length !== sceneIndexes.length) {
    throw await hostedVisualRevisionBlocked(
      "",
      "Hosted visual regeneration targets must be unique.",
    );
  }
  return requested;
}

export async function persistHostedVisualRevisionBlock(
  runId: string,
  error: unknown,
): Promise<never> {
  if (error instanceof SafeExitError) {
    await appendLedgerEvent({
      runId,
      type: "GUARD_BLOCKED",
      stage: "visuals-hosted-reopen",
      message: error.message,
    });
  }
  throw error;
}
