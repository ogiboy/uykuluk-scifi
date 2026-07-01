import { artifactPath } from "../core/artifacts.js";
import type { RunRecord } from "../core/state.js";
import { readJsonFile } from "../utils/json.js";
import {
  finalReviewBundleCommand,
  finalReviewBundleJsonPath,
  finalReviewBundleMarkdownPath,
  finalReviewBundleSchema,
  type FinalReviewBundle,
} from "./finalReviewBundleContracts.js";
import {
  finalReviewBundleDecisionStaleReason,
  finalReviewBundleDraftDigestStaleReason,
  finalReviewBundleReadyAction,
  finalReviewBundleRunIdStaleReason,
  finalReviewBundleStateStaleReason,
  type FinalReviewDecisionBinding,
} from "./finalReviewBundleValidation.js";
import { readRenderDecisionStatus } from "./renderDecisionStatus.js";
import { reviewDraftRender } from "./reviewRender.js";

export type FinalReviewBundleStatus =
  | { kind: "missing"; nextAction: string | null }
  | { kind: "invalid"; message: string; nextAction: string }
  | { kind: "stale"; message: string; nextAction: string }
  | {
      bundle: FinalReviewBundle;
      kind: "present";
      message: string;
      nextAction: string;
      reviewPath: string;
    };

/**
 * Reads and validates the local final review bundle for a run.
 *
 * @param run - The run whose final-review bundle should be inspected.
 * @returns The current final-review bundle status.
 */
export async function readFinalReviewBundleStatus(
  run: RunRecord,
): Promise<FinalReviewBundleStatus> {
  const nextAction = run.state === "RENDERED" ? finalReviewBundleCommand(run.runId) : null;
  let bundle: FinalReviewBundle;
  try {
    bundle = finalReviewBundleSchema.parse(
      await readJsonFile<unknown>(artifactPath(run.runId, finalReviewBundleJsonPath)),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { kind: "missing", nextAction };
    }
    return {
      kind: "invalid",
      message: `Final review bundle could not be trusted: ${
        error instanceof Error ? error.message : String(error)
      }`,
      nextAction: finalReviewBundleCommand(run.runId),
    };
  }
  try {
    const staleReason = await finalReviewBundleStaleReason(run, bundle);
    if (staleReason) {
      return stale(staleReason, run.runId);
    }
  } catch (error) {
    return {
      kind: "invalid",
      message: `Final review bundle dependency check failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
      nextAction: finalReviewBundleCommand(run.runId),
    };
  }
  return {
    bundle,
    kind: "present",
    message: `Final review bundle ready: ${bundle.status}.`,
    nextAction: finalReviewBundleReadyAction(bundle),
    reviewPath: finalReviewBundleMarkdownPath,
  };
}

async function finalReviewBundleStaleReason(
  run: RunRecord,
  bundle: FinalReviewBundle,
): Promise<string | null> {
  const runMismatch = finalReviewBundleRunIdStaleReason(bundle.runId, run.runId);
  if (runMismatch) return runMismatch;
  const stateMismatch = finalReviewBundleStateStaleReason(run.state);
  if (stateMismatch) return stateMismatch;
  const manifest = await reviewDraftRender(run.runId);
  const digestMismatch = finalReviewBundleDraftDigestStaleReason(bundle, manifest.output.sha256);
  if (digestMismatch) return digestMismatch;
  const decisionStatus = await readRenderDecisionStatus(run);
  return finalReviewBundleDecisionStaleReason(bundle, finalReviewDecisionBinding(decisionStatus));
}

function stale(message: string, runId: string): FinalReviewBundleStatus {
  return {
    kind: "stale",
    message,
    nextAction: finalReviewBundleCommand(runId),
  };
}

function finalReviewDecisionBinding(
  decisionStatus: Awaited<ReturnType<typeof readRenderDecisionStatus>>,
): FinalReviewDecisionBinding {
  if (decisionStatus.kind !== "present") {
    return { kind: decisionStatus.kind };
  }
  return {
    createdAt: decisionStatus.decision.createdAt,
    decision: decisionStatus.decision.decision,
    kind: "present",
  };
}
