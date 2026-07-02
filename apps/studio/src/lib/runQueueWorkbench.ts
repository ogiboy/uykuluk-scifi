import type { StudioRunSummary } from "./runSummaries";

export const runQueueSortValues = [
  "updated-desc",
  "oldest-first",
  "blocked-first",
  "decision-first",
] as const;

export type RunQueueSort = (typeof runQueueSortValues)[number];

export const runQueueDensityValues = ["compact", "comfortable"] as const;

export type RunQueueDensity = (typeof runQueueDensityValues)[number];

export type RunQueueWorkbenchInput = Readonly<{
  maxBlockedActions: number;
  sort: RunQueueSort;
}>;

/**
 * Applies operator-facing queue controls after the primary run filter/search projection.
 *
 * @param runs - The filtered run summaries to refine.
 * @param input - Sort and blocked-action controls selected by the operator.
 * @returns A refined run queue without mutating the input order.
 */
export function applyRunQueueWorkbenchControls(
  runs: readonly StudioRunSummary[],
  input: RunQueueWorkbenchInput,
): StudioRunSummary[] {
  return runs
    .filter((run) => run.blockedActionCount <= input.maxBlockedActions)
    .sort((left, right) => compareRuns(left, right, input.sort));
}

function compareRuns(left: StudioRunSummary, right: StudioRunSummary, sort: RunQueueSort): number {
  switch (sort) {
    case "updated-desc":
      return right.updatedAt.localeCompare(left.updatedAt);
    case "oldest-first":
      return left.updatedAt.localeCompare(right.updatedAt);
    case "blocked-first":
      return right.blockedActionCount - left.blockedActionCount || compareDecisionNeed(left, right);
    case "decision-first":
      return compareDecisionNeed(left, right) || right.updatedAt.localeCompare(left.updatedAt);
  }
}

function compareDecisionNeed(left: StudioRunSummary, right: StudioRunSummary): number {
  return Number(needsRenderDecision(right)) - Number(needsRenderDecision(left));
}

function needsRenderDecision(run: StudioRunSummary): boolean {
  return run.state === "RENDERED" && run.renderDecision.kind !== "present";
}
