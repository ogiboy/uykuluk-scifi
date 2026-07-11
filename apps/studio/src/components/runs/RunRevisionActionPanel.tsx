import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <section aria-labelledby='revision-action-heading'>
      <Card>
        <CardHeader>
          <p className='text-muted-foreground text-xs font-semibold tracking-[0.28em] uppercase'>
            Revision control
          </p>
          <CardTitle id='revision-action-heading'>Revise local artifacts</CardTitle>
          <CardDescription>
            Studio submits revision text to guarded local routes only. CLI/core records before/after
            evidence and invalidates stale approvals, reviews, or downstream artifacts.
          </CardDescription>
        </CardHeader>
        <CardContent className='grid gap-4'>
          <RunScriptRevisionActionPanel run={run} />
          <RunPackageArtifactRevisionActionPanel run={run} />
        </CardContent>
      </Card>
    </section>
  );
}
