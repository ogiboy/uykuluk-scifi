import {
  countStudioActionWorkbench,
  type StudioActionWorkbenchCounts,
  type StudioActionWorkbenchRun,
} from "./studioActionWorkbench";

export type HomeActionQueueSummaryKey = keyof StudioActionWorkbenchCounts;

export type HomeActionQueueSummaryItem = Readonly<{
  detail: string;
  key: HomeActionQueueSummaryKey;
  label: string;
  tone: "blocked" | "complete" | "neutral" | "web";
  value: number;
}>;

/**
 * Builds the compact action-category summary shown on the Studio home queue.
 *
 * @param runs - Run summaries or details shown in the home operator queue.
 * @returns Ordered web, blocked, review, CLI-only, and complete counts.
 */
export function homeActionQueueSummaryItems(
  runs: readonly StudioActionWorkbenchRun[],
): HomeActionQueueSummaryItem[] {
  const counts = countStudioActionWorkbench(runs);
  return [
    {
      detail: "Guarded local routes can run from Studio.",
      key: "webAction",
      label: "Web actions",
      tone: "web",
      value: counts.webAction,
    },
    {
      detail: "Fail-closed recovery or diagnostics are still required.",
      key: "blockedCli",
      label: "Blocked CLI",
      tone: "blocked",
      value: counts.blockedCli,
    },
    {
      detail: "The run needs operator review before a run-bound action is safe.",
      key: "needsReview",
      label: "Needs review",
      tone: "neutral",
      value: counts.needsReview,
    },
    {
      detail: "The safe next step is visible but not exposed as a web route.",
      key: "cliOnly",
      label: "CLI-only",
      tone: "neutral",
      value: counts.cliOnly,
    },
    {
      detail: "No next local action is currently required.",
      key: "complete",
      label: "Complete",
      tone: "complete",
      value: counts.complete,
    },
  ];
}
