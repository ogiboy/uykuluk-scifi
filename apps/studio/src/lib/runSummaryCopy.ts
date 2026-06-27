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
