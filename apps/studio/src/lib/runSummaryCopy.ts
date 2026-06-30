import type { StudioRunSummary } from "./runSummaries";

/**
 * Formats review counts for a run.
 *
 * @param run - The run summary containing approval, warning, and artifact counts.
 * @returns A string in the form "<approvals> approvals · <warnings> warnings · <artifacts> artifacts".
 */
export function formatRunReviewCounts(
  run: Pick<StudioRunSummary, "approvalCount" | "artifactCount" | "warningCount">,
): string {
  return `${run.approvalCount} approvals · ${run.warningCount} warnings · ${run.artifactCount} artifacts`;
}

/**
 * Formats the local render-decision status for compact run surfaces.
 *
 * @param run - The run summary containing the render decision state.
 * @returns Operator-facing render-decision copy for list and latest-run cards.
 */
export function formatRunRenderDecision(run: Pick<StudioRunSummary, "renderDecision">): string {
  if (run.renderDecision.kind === "present") {
    return `${run.renderDecision.decision.decision} by ${run.renderDecision.decision.reviewedBy}`;
  }
  return run.renderDecision.kind;
}
