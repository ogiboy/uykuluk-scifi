import type { StudioRunSummary } from "./runSummaries";
import { operatorDecisionPriority } from "./runQueueDecisions";

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

export type RunQueueEmptyState = Readonly<{
  heading: string;
  message: string;
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

/**
 * Builds the operator-facing empty state for the current run queue projection.
 *
 * @param totalRuns - Number of persisted runs before any queue projection.
 * @param matchingRuns - Runs that match the selected category and search query.
 * @param visibleRuns - Runs still visible after display tuning controls are applied.
 * @returns Empty-state copy that distinguishes no data from filtered-away data.
 */
export function runQueueEmptyState(
  totalRuns: number,
  matchingRuns: number,
  visibleRuns: number,
): RunQueueEmptyState {
  if (totalRuns === 0) {
    return {
      heading: "No runs yet",
      message: "Start with the CLI source of truth: pnpm producer ideas.",
    };
  }
  if (matchingRuns === 0) {
    return {
      heading: "No matching runs",
      message: "Clear the search text or choose a broader run filter.",
    };
  }
  if (visibleRuns === 0) {
    return {
      heading: "All matching runs are hidden",
      message: "Raise the blocker limit or reset the queue view to show matching runs.",
    };
  }
  return {
    heading: "No runs shown",
    message: "Reset the queue view to return to the default operator projection.",
  };
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
  return operatorDecisionPriority(right) - operatorDecisionPriority(left);
}
