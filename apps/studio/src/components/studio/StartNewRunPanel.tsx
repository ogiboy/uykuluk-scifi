import type { StartIdeasReadinessSummary } from "@/lib/startIdeasReadiness";
import { StartIdeasActionPanel } from "./StartIdeasActionPanel";

type StartNewRunPanelProps = Readonly<{
  readiness: StartIdeasReadinessSummary;
}>;

/**
 * Renders the always-available guarded entry point for a new idea-generation run.
 *
 * @param readiness - Read-only doctor-derived provider readiness guidance.
 * @returns A compact rail panel that starts a separate local run through CLI/core.
 */
export function StartNewRunPanel({ readiness }: StartNewRunPanelProps) {
  return (
    <section className='panel compact-panel' aria-labelledby='start-new-run-heading'>
      <h3 id='start-new-run-heading'>Start another production run</h3>
      <StartIdeasActionPanel
        buttonLabel='Start new idea run'
        description='Create a separate local idea run while existing runs stay reviewable in the queue.'
        readiness={readiness}
      />
    </section>
  );
}
