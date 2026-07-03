import type { StudioRunSummary } from "./runSummaries";
import { needsOperatorReviewDecision } from "./runQueueDecisions";
import { buildStudioActionWorkbench } from "./studioActionWorkbench";

export const runQueueFilterValues = ["all", "attention", "ready", "rendered", "decision"] as const;

export type RunQueueFilter = (typeof runQueueFilterValues)[number];

export type RunQueueFilterInput = Readonly<{
  filter: RunQueueFilter;
  query: string;
}>;

/**
 * Filters Studio run summaries for operator queue views.
 *
 * @param runs - The run summaries to filter.
 * @param input - The selected filter and free-text query.
 * @returns The filtered run summaries in their original order.
 */
export function filterStudioRunQueue(
  runs: readonly StudioRunSummary[],
  input: RunQueueFilterInput,
): StudioRunSummary[] {
  const query = input.query.trim().toLowerCase();
  return runs.filter((run) => runMatchesFilter(run, input.filter) && runMatchesQuery(run, query));
}

/**
 * Counts runs for each queue filter.
 *
 * @param runs - The run summaries to count.
 * @returns A count map keyed by run queue filter.
 */
export function countStudioRunQueueFilters(
  runs: readonly StudioRunSummary[],
): Record<RunQueueFilter, number> {
  return {
    all: runs.length,
    attention: runs.filter((run) => runMatchesFilter(run, "attention")).length,
    decision: runs.filter((run) => runMatchesFilter(run, "decision")).length,
    ready: runs.filter((run) => runMatchesFilter(run, "ready")).length,
    rendered: runs.filter((run) => runMatchesFilter(run, "rendered")).length,
  };
}

function runMatchesFilter(run: StudioRunSummary, filter: RunQueueFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "attention":
      return (
        run.blockedActionCount > 0 ||
        run.readinessStatus !== "passed" ||
        run.evidenceStatus !== "available" ||
        run.renderDecision.kind === "invalid" ||
        run.renderDecision.kind === "stale" ||
        run.channelHandoffDecision.kind === "invalid" ||
        run.channelHandoffDecision.kind === "stale"
      );
    case "ready":
      return (
        run.readinessStatus === "passed" &&
        run.evidenceStatus === "available" &&
        run.blockedActionCount === 0
      );
    case "rendered":
      return run.state === "RENDERED";
    case "decision":
      return needsOperatorReviewDecision(run);
  }
}

function runMatchesQuery(run: StudioRunSummary, query: string): boolean {
  if (!query) {
    return true;
  }
  const action = buildStudioActionWorkbench(run).primary;
  return [
    run.runId,
    run.state,
    run.readinessStatus,
    run.evidenceStatus,
    run.renderDecision.kind,
    run.channelHandoff.kind,
    run.channelHandoff.kind === "present" ? run.channelHandoff.handoff.status : "",
    run.channelHandoffDecision.kind,
    action.label,
    action.routePath ?? "",
    action.command ?? "",
    run.nextRecommendedCommand ?? "",
  ].some((value) => value.toLowerCase().includes(query));
}
