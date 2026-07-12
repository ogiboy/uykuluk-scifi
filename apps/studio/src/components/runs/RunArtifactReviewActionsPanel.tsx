"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  artifactReviewActionsForRun,
  type StudioArtifactReviewAction,
  type StudioRenderPlanReviewActionRun,
} from "@/lib/actions/renderPlanReviewAction";
import { useStudioGuardedActionSubmit } from "@/lib/mutations/useStudioGuardedActionSubmit";
import { useState } from "react";
import { StudioMutationResultPanel } from "../studio/StudioMutationResultPanel";
import { RunStageActionConfirmationDialog } from "./RunStageActionConfirmationDialog";

type RunArtifactReviewActionsPanelProps = Readonly<{ run: StudioRenderPlanReviewActionRun }>;

type RunArtifactReviewActionCardProps = Readonly<{
  action: StudioArtifactReviewAction;
  runId: string;
  state: string;
}>;

/**
 * Renders artifact-backed read-only review actions when local handoff files exist.
 *
 * @param run - The run detail used to detect complete review artifact groups.
 */
export function RunArtifactReviewActionsPanel({ run }: RunArtifactReviewActionsPanelProps) {
  const actions = artifactReviewActionsForRun(run);

  return actions.map((action) => (
    <RunArtifactReviewActionCard
      action={action}
      key={action.actionId}
      runId={run.runId}
      state={run.state}
    />
  ));
}

function RunArtifactReviewActionCard({
  action,
  runId,
  state: currentState,
}: RunArtifactReviewActionCardProps) {
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const { state, submit } = useStudioGuardedActionSubmit(
    `${action.heading} opens a local artifact handoff without advancing state.`,
  );

  async function submitReview(): Promise<void> {
    setConfirmationOpen(false);
    await submit({
      actionId: action.actionId,
      body: { runId },
      errorToastTitle: `${action.heading} was blocked`,
      fallbackError: `${action.heading} could not complete.`,
      routePath: action.routePath,
      submittingMessage: `Opening guarded ${action.heading.toLowerCase()}...`,
      successMessage: `${action.heading} completed. Inspect the generated local handoff before continuing.`,
      successToastTitle: `${action.heading} completed`,
    });
  }

  return (
    <Card aria-labelledby={`${action.actionId}-heading`} className='border-sky-500/20 bg-sky-500/5'>
      <CardHeader>
        <CardDescription>{action.eyebrow}</CardDescription>
        <CardTitle>
          <h2 id={`${action.actionId}-heading`}>{action.heading}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className='text-muted-foreground space-y-3 text-sm'>
        <p>{action.details}</p>
        <p>
          This is a guarded local review handoff only. It does not approve cost, generate media,
          upload, schedule, or publish.
        </p>
        <StudioMutationResultPanel state={state} />
        <p className='bg-background/70 text-foreground ring-border/20 rounded-lg px-3 py-2 font-mono text-xs ring-1'>
          CLI equivalent: {action.command}
        </p>
      </CardContent>
      <CardFooter>
        <Button
          disabled={state.kind === "submitting"}
          type='button'
          onClick={() => setConfirmationOpen(true)}
        >
          {state.kind === "submitting" ? "Opening..." : action.buttonLabel}
        </Button>
      </CardFooter>
      <RunStageActionConfirmationDialog
        action={action}
        currentState={currentState}
        isSubmitting={state.kind === "submitting"}
        nextRecommendedCommand={action.command}
        open={confirmationOpen}
        runId={runId}
        onConfirm={() => void submitReview()}
        onOpenChange={setConfirmationOpen}
      />
    </Card>
  );
}
