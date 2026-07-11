import { SafeExitError } from "../core/errors.js";
import { listRuns } from "../core/runStore.js";

type RunIdRecord = { runId: string };

type ListRunRecords = () => Promise<RunIdRecord[]>;

export type StatusRunSelectorOptions = { latest?: boolean; run?: string };

export async function resolveStatusRunId(
  options: StatusRunSelectorOptions,
  listRunRecords: ListRunRecords = listRuns,
): Promise<string> {
  if (options.run && options.latest) {
    throw new SafeExitError("Use either --run <run_id> or --latest, not both.");
  }
  if (options.run) {
    return options.run;
  }
  if (!options.latest) {
    throw new SafeExitError("Provide --run <run_id> or --latest.");
  }
  const runs = await listRunRecords();
  if (runs.length === 0) {
    throw new SafeExitError("No runs found. Start with pnpm producer ideas.");
  }
  return runs[0].runId;
}
