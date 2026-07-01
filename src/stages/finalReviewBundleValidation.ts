import type { FinalReviewBundle } from "./finalReviewBundleContracts.js";

const finalReviewBundleMarkdownPath = "production/review_bundle.md";

export type FinalReviewDecisionBinding =
  | {
      createdAt: string;
      decision: "accepted-for-local-review" | "needs-revision" | "rejected";
      kind: "present";
    }
  | { kind: "missing" }
  | { kind: "invalid" | "stale" };

/**
 * Checks whether a final review bundle still belongs to the current run.
 *
 * @param bundleRunId - The run identifier persisted in the bundle.
 * @param runId - The current run identifier.
 * @returns A stale reason when the bundle belongs elsewhere.
 */
export function finalReviewBundleRunIdStaleReason(
  bundleRunId: string,
  runId: string,
): string | null {
  return bundleRunId === runId ? null : "Final review bundle belongs to a different run.";
}

/**
 * Checks whether a final review bundle is still valid for the current run state.
 *
 * @param state - The current run state.
 * @returns A stale reason when the bundle is no longer valid for the state.
 */
export function finalReviewBundleStateStaleReason(state: string | undefined): string | null {
  return state === "RENDERED"
    ? null
    : `Final review bundle was created, but the run is ${state ?? "unknown"}.`;
}

/**
 * Checks whether the final review bundle still matches the current draft render digest.
 *
 * @param bundle - The persisted final review bundle.
 * @param currentDraftRenderDigest - The current trusted draft-render digest, when available.
 * @returns A stale reason when the digest no longer matches.
 */
export function finalReviewBundleDraftDigestStaleReason(
  bundle: FinalReviewBundle,
  currentDraftRenderDigest: string | null,
): string | null {
  return bundle.draftRender.sha256 === currentDraftRenderDigest
    ? null
    : "Final review bundle was created for a different draft render digest.";
}

/**
 * Checks whether the final review bundle still matches the current render decision binding.
 *
 * @param bundle - The persisted final review bundle.
 * @param decisionBinding - The current trusted render-decision binding.
 * @returns A stale reason when the decision binding no longer matches.
 */
export function finalReviewBundleDecisionStaleReason(
  bundle: FinalReviewBundle,
  decisionBinding: FinalReviewDecisionBinding,
): string | null {
  if (decisionBinding.kind === "present") {
    return presentDecisionStaleReason(bundle, decisionBinding);
  }
  if (bundle.renderDecision.kind === "present") {
    return "Final review bundle includes a render decision that is no longer trusted.";
  }
  return decisionBinding.kind === "invalid" || decisionBinding.kind === "stale"
    ? `Final review bundle depends on ${decisionBinding.kind} render decision evidence.`
    : null;
}

/**
 * Builds the operator next action for a trusted final review bundle.
 *
 * @param bundle - The trusted final review bundle.
 * @returns The next safe operator action.
 */
export function finalReviewBundleReadyAction(bundle: FinalReviewBundle): string {
  if (bundle.status === "decision-pending") {
    return bundle.nextSafeAction;
  }
  if (bundle.status === "accepted-for-local-review") {
    return `Local final review handoff is ready at ${finalReviewBundleMarkdownPath}. Upload remains disabled until a future private-upload approval/config path exists.`;
  }
  return bundle.nextSafeAction;
}

function presentDecisionStaleReason(
  bundle: FinalReviewBundle,
  decisionBinding: Extract<FinalReviewDecisionBinding, { kind: "present" }>,
): string | null {
  if (bundle.renderDecision.kind !== "present") {
    return "Final review bundle is missing the recorded render decision.";
  }
  if (bundle.renderDecision.createdAt !== decisionBinding.createdAt) {
    return "Final review bundle was created for a different render decision.";
  }
  if (bundle.renderDecision.decision !== decisionBinding.decision) {
    return "Final review bundle was created for a different render decision outcome.";
  }
  return null;
}
