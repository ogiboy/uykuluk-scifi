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
  try {
    const bundle = finalReviewBundleSchema.parse(
      await readJsonFile<unknown>(artifactPath(run.runId, finalReviewBundleJsonPath)),
    );
    if (bundle.runId !== run.runId) {
      return stale("Final review bundle belongs to a different run.", run.runId);
    }
    const staleReason = await finalReviewBundleStaleReason(run, bundle);
    if (staleReason) {
      return stale(staleReason, run.runId);
    }
    return {
      bundle,
      kind: "present",
      message: `Final review bundle ready: ${bundle.status}.`,
      nextAction: finalReviewBundleReadyAction(bundle),
      reviewPath: finalReviewBundleMarkdownPath,
    };
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
}

async function finalReviewBundleStaleReason(
  run: RunRecord,
  bundle: FinalReviewBundle,
): Promise<string | null> {
  if (run.state !== "RENDERED") {
    return `Final review bundle was created, but the run is ${run.state}.`;
  }
  const manifest = await reviewDraftRender(run.runId);
  if (bundle.draftRender.sha256 !== manifest.output.sha256) {
    return "Final review bundle was created for a different draft render digest.";
  }
  const decisionStatus = await readRenderDecisionStatus(run);
  if (decisionStatus.kind === "present") {
    if (bundle.renderDecision.kind !== "present") {
      return "Final review bundle is missing the recorded render decision.";
    }
    if (bundle.renderDecision.createdAt !== decisionStatus.decision.createdAt) {
      return "Final review bundle was created for a different render decision.";
    }
    if (bundle.renderDecision.decision !== decisionStatus.decision.decision) {
      return "Final review bundle was created for a different render decision outcome.";
    }
    return null;
  }
  if (bundle.renderDecision.kind === "present") {
    return "Final review bundle includes a render decision that is no longer trusted.";
  }
  if (decisionStatus.kind === "invalid" || decisionStatus.kind === "stale") {
    return `Final review bundle depends on ${decisionStatus.kind} render decision evidence.`;
  }
  return null;
}

function finalReviewBundleReadyAction(bundle: FinalReviewBundle): string {
  if (bundle.status === "decision-pending") {
    return bundle.nextSafeAction;
  }
  if (bundle.status === "accepted-for-local-review") {
    return `Local final review handoff is ready at ${finalReviewBundleMarkdownPath}. Upload remains disabled until a future private-upload approval/config path exists.`;
  }
  return bundle.nextSafeAction;
}

function stale(message: string, runId: string): FinalReviewBundleStatus {
  return {
    kind: "stale",
    message,
    nextAction: finalReviewBundleCommand(runId),
  };
}
