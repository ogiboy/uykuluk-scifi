"use client";

import { Button } from "@/components/ui/button";
import type { StudioRunDetail } from "@/lib/runSummaries";
import { useStudioStageActionSubmit } from "@/lib/useStudioStageActionSubmit";
import { StudioMutationResultPanel } from "../studio/StudioMutationResultPanel";
import { RunStageActionConfirmationDialog } from "./RunStageActionConfirmationDialog";

type RunStageActionPanelProps = Readonly<{
  run: Pick<StudioRunDetail, "nextRecommendedCommand" | "runId" | "state">;
}>;

/**
 * Renders the guarded web control for safe workflow-stage commands currently recommended by core.
 *
 * @param run - The current run projection used to choose and submit the stage action.
 */
export function RunStageActionPanel({ run }: RunStageActionPanelProps) {
  const { action, confirmationOpen, setConfirmationOpen, state, submitStageAction } =
    useStudioStageActionSubmit(run, {
      errorToastTitle: "Workflow action was blocked",
      fallbackError: "Workflow action could not complete.",
      idleMessage:
        "Run-scoped workflow actions use the same CLI/core command that Studio recommends.",
      submittingMessage: "Running guarded local workflow action...",
      successMessage: "Workflow action completed. Updating the run detail from persisted state.",
      successToastTitle: "Workflow action completed",
    });

  if (!action) {
    return null;
  }

  return (
    <section className='panel stage-action-panel' aria-labelledby='stage-action-heading'>
      <div>
        <p className='eyebrow'>Workflow control</p>
        <h2 id='stage-action-heading'>{action.heading}</h2>
      </div>
      <p>{action.description}</p>
      <p>
        Studio will call a guarded local route, which then runs the canonical producer CLI. Core
        state, approvals, cost checks, provider config, readiness, and evidence remain
        authoritative.
      </p>
      <Button
        disabled={state.kind === "submitting"}
        type='button'
        onClick={() => setConfirmationOpen(true)}
      >
        {state.kind === "submitting" ? "Running..." : action.buttonLabel}
      </Button>
      <StudioMutationResultPanel state={state} />
      {run.nextRecommendedCommand ? (
        <p className='artifact-action'>CLI equivalent: {run.nextRecommendedCommand}</p>
      ) : null}
      <RunStageActionConfirmationDialog
        action={action}
        currentState={run.state}
        isSubmitting={state.kind === "submitting"}
        nextRecommendedCommand={run.nextRecommendedCommand}
        open={confirmationOpen}
        runId={run.runId}
        onConfirm={() => void submitStageAction()}
        onOpenChange={setConfirmationOpen}
      />
    </section>
  );
}
