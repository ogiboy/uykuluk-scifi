import { StartIdeasActionPanel } from "./StartIdeasActionPanel";

/**
 * Renders the always-available guarded entry point for a new idea-generation run.
 *
 * @returns A compact rail panel that starts a separate local run through CLI/core.
 */
export function StartNewRunPanel() {
  return (
    <section className='panel compact-panel' aria-labelledby='start-new-run-heading'>
      <h3 id='start-new-run-heading'>Start another production run</h3>
      <StartIdeasActionPanel
        buttonLabel='Start new idea run'
        description='Create a separate local idea run while existing runs stay reviewable in the queue.'
      />
    </section>
  );
}
