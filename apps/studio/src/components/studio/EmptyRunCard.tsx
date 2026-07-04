import { CopyableCommand } from "./CopyableCommand";
import { StartIdeasActionPanel } from "./StartIdeasActionPanel";
import { NO_RUNS_NEXT_COMMAND } from "@/lib/runSummaryCopy";

/**
 * Renders the first-run empty state with guarded local idea generation.
 *
 * @returns The empty queue card for Studio home.
 */
export function EmptyRunCard() {
  return (
    <article className='active-run-card'>
      <h3>No local runs yet</h3>
      <p>
        Start with a safe local idea run. Studio will show the persisted run queue, evidence,
        readiness, and guarded approval actions once CLI/core creates the run.
      </p>
      <div className='operator-command-block'>
        <strong>Next safe action</strong>
        <CopyableCommand command={NO_RUNS_NEXT_COMMAND} label='Next safe action' />
      </div>
      <StartIdeasActionPanel />
    </article>
  );
}
