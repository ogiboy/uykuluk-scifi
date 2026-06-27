import type { StudioRunSummary } from "./runSummaries";

export function formatRunReviewCounts(
  run: Pick<StudioRunSummary, "approvalCount" | "artifactCount" | "warningCount">,
): string {
  return `${run.approvalCount} approvals · ${run.warningCount} warnings · ${run.artifactCount} artifacts`;
}
