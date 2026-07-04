"use client";

import { Button } from "@/components/ui/button";
import type { StudioRunDetail } from "@/lib/runSummaries";
import { stageActionForRun } from "@/lib/studioStageAction";
import { useStudioGuardedActionSubmit } from "@/lib/useStudioGuardedActionSubmit";

type RunStageActionPanelProps = Readonly<{
  run: Pick<StudioRunDetail, "nextRecommendedCommand" | "runId" | "state">;
}>;

/**
 * Renders the guarded web control for safe workflow-stage commands currently recommended by core.
 *
 * @param run - The current run projection used to choose and submit the stage action.
 */
export function RunStageActionPanel({ run }: RunStageActionPanelProps) {
  const config = stageActionForRun(run);
  const { state, submit } = useStudioGuardedActionSubmit(
    "Run-scoped workflow actions use the same CLI/core command that Studio recommends.",
  );

  if (!config) {
    return null;
  }

  async function submitStageAction(): Promise<void> {
    if (!config) return;
    await submit({
      actionId: config.actionId,
      body: { runId: run.runId },
      errorToastTitle: "Workflow action was blocked",
      fallbackError: "Workflow action could not complete.",
      routePath: config.routePath,
      submittingMessage: "Running guarded local workflow action...",
      successMessage: "Workflow action completed. Updating the run detail from persisted state.",
      successToastTitle: "Workflow action completed",
    });
  }

  return (
    <section className='panel stage-action-panel' aria-labelledby='stage-action-heading'>
      <div>
        <p className='eyebrow'>Workflow control</p>
        <h2 id='stage-action-heading'>{config.heading}</h2>
      </div>
      <p>{config.description}</p>
      <p>
        Studio will call a guarded local route, which then runs the canonical producer CLI. Core
        state, approvals, cost checks, provider config, readiness, and evidence remain
        authoritative.
      </p>
      <Button
        disabled={state.kind === "submitting"}
        type='button'
        onClick={() => void submitStageAction()}
      >
        {state.kind === "submitting" ? "Running..." : config.buttonLabel}
      </Button>
      <p className={state.kind === "error" ? "blocked" : undefined}>{state.message}</p>
      {run.nextRecommendedCommand ? (
        <p className='artifact-action'>CLI equivalent: {run.nextRecommendedCommand}</p>
      ) : null}
    </section>
  );
}
