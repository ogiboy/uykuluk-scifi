import type { StudioRunDetail } from "@/lib/runSummaries";
import { isStudioRevisionState } from "@/lib/studioRevisionEligibility";
import { RunPackageArtifactRevisionActionPanel } from "./RunPackageArtifactRevisionActionPanel";
import { RunScriptRevisionActionPanel } from "./RunScriptRevisionActionPanel";

type RunRevisionActionPanelProps = Readonly<{
  run: Pick<StudioRunDetail, "revisionSources" | "runId" | "state">;
}>;

/**
 * Renders guarded local artifact revision controls when the run is in a revisable state.
 *
 * @param run - The current run detail projection.
 */
export function RunRevisionActionPanel({ run }: RunRevisionActionPanelProps) {
  if (!isStudioRevisionState(run.state)) {
    return null;
  }
  return (
    <section className='panel revision-action-group' aria-labelledby='revision-action-heading'>
      <div>
        <p className='eyebrow'>Revision control</p>
        <h2 id='revision-action-heading'>Revise local artifacts</h2>
      </div>
      <p>
        Studio submits revision text to guarded local routes only. CLI/core records before/after
        evidence and invalidates stale approvals, reviews, or downstream artifacts.
      </p>
      <RunScriptRevisionActionPanel run={run} />
      <RunPackageArtifactRevisionActionPanel run={run} />
    </section>
  );
}
