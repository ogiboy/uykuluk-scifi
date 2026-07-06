import { buildStudioActionWorkbench, type StudioActionWorkbenchRun } from "./studioActionWorkbench";

export type StudioActionWorkbenchCounts = Readonly<{
  blockedCli: number;
  cliOnly: number;
  complete: number;
  needsReview: number;
  webAction: number;
}>;

/**
 * Counts action-workbench categories for an operator queue projection.
 *
 * @param runs - Run summaries or details shown in the current queue.
 * @returns Counts for guarded web, blocked CLI, CLI-only, review-needed, and complete states.
 */
export function countStudioActionWorkbench(
  runs: readonly StudioActionWorkbenchRun[],
): StudioActionWorkbenchCounts {
  return runs.reduce<StudioActionWorkbenchCounts>(
    (counts, run) => {
      const tone = buildStudioActionWorkbench(run).primary.tone;
      if (tone === "available") {
        return { ...counts, webAction: counts.webAction + 1 };
      }
      if (tone === "blocked") {
        return { ...counts, blockedCli: counts.blockedCli + 1 };
      }
      if (tone === "attention") {
        return { ...counts, needsReview: counts.needsReview + 1 };
      }
      if (tone === "cli-only") {
        return { ...counts, cliOnly: counts.cliOnly + 1 };
      }
      return { ...counts, complete: counts.complete + 1 };
    },
    {
      blockedCli: 0,
      cliOnly: 0,
      complete: 0,
      needsReview: 0,
      webAction: 0,
    },
  );
}
