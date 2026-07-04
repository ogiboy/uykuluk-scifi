"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { StudioRunDetail } from "@/lib/runSummaries";
import { stageActionForRun } from "@/lib/studioStageAction";
import { useStudioGuardedActionSubmit } from "@/lib/useStudioGuardedActionSubmit";
import { RunStageActionConfirmationDialog } from "./RunStageActionConfirmationDialog";

type RunQuickStageActionButtonProps = Readonly<{
  label?: string;
  run: Pick<StudioRunDetail, "nextRecommendedCommand" | "runId" | "state">;
  variant?: "default" | "secondary";
}>;

/**
 * Renders a compact guarded workflow-stage action for queue and home surfaces.
 *
 * Approval and decision forms stay on the run detail rail. This button only appears when the
 * CLI/core next command maps to a no-extra-input local stage or review action.
 *
 * @param label - Optional compact label for dense surfaces.
 * @param run - The run projection used to select and submit the stage action.
 * @param variant - The shadcn button variant to use.
 */
export function RunQuickStageActionButton({
  label = "Run web action",
  run,
  variant = "default",
}: RunQuickStageActionButtonProps) {
  const action = stageActionForRun(run);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const { state, submit } = useStudioGuardedActionSubmit(
    "Queue actions use guarded local routes and CLI/core remains authoritative.",
  );

  if (!action) {
    return null;
  }

  async function submitStageAction(): Promise<void> {
    if (!action) return;
    setConfirmationOpen(false);
    await submit({
      actionId: action.actionId,
      body: { runId: run.runId },
      errorToastTitle: "Workflow action was blocked",
      fallbackError: "Workflow action could not complete.",
      routePath: action.routePath,
      submittingMessage: "Running guarded local workflow action...",
      successMessage: "Workflow action completed. Updating persisted local state.",
      successToastTitle: "Workflow action completed",
    });
  }

  const isSubmitting = state.kind === "submitting";
  const buttonLabel = isSubmitting ? "Running..." : label;

  return (
    <>
      <Button
        aria-label={`${action.heading} for ${run.runId}`}
        disabled={isSubmitting}
        title={action.description}
        type='button'
        variant={variant}
        onClick={() => setConfirmationOpen(true)}
      >
        {buttonLabel}
      </Button>
      <RunStageActionConfirmationDialog
        action={action}
        currentState={run.state}
        isSubmitting={isSubmitting}
        nextRecommendedCommand={run.nextRecommendedCommand}
        open={confirmationOpen}
        runId={run.runId}
        onConfirm={() => void submitStageAction()}
        onOpenChange={setConfirmationOpen}
      />
    </>
  );
}
