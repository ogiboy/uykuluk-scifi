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
import { useStudioStageActionSubmit } from "@/lib/mutations/useStudioStageActionSubmit";
import type { StudioRunDetail } from "@/lib/runSummaries";
import Link from "next/link";
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

  if (action.submission === "voice-surface") {
    return (
      <section aria-labelledby='stage-action-heading'>
        <Card>
          <CardHeader>
            <CardTitle id='stage-action-heading'>Open voice production</CardTitle>
            <CardDescription>
              Local voice can run directly there; hosted voice requires the exact persisted quote
              confirmation shown in the audition surface.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild>
              <Link href={`/runs/${run.runId}?tab=voice`}>Open voice production</Link>
            </Button>
          </CardFooter>
        </Card>
      </section>
    );
  }

  return (
    <section aria-labelledby='stage-action-heading'>
      <Card>
        <CardHeader>
          <p className='text-muted-foreground text-xs font-semibold tracking-[0.28em] uppercase'>
            Workflow control
          </p>
          <CardTitle id='stage-action-heading'>{action.heading}</CardTitle>
          <CardDescription>{action.description}</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <p className='text-muted-foreground text-sm'>
            Studio will call a guarded local route, which then runs the canonical producer CLI. Core
            state, approvals, cost checks, provider config, readiness, and evidence remain
            authoritative.
          </p>
          <StudioMutationResultPanel state={state} />
        </CardContent>
        <CardFooter className='flex-col items-start gap-3 sm:flex-row sm:items-center'>
          <Button
            disabled={state.kind === "submitting"}
            type='button'
            onClick={() => setConfirmationOpen(true)}
          >
            {state.kind === "submitting" ? "Running..." : action.buttonLabel}
          </Button>
          {run.nextRecommendedCommand ? (
            <code className='bg-muted text-muted-foreground max-w-full rounded-md px-2 py-1 text-xs break-all'>
              CLI equivalent: {run.nextRecommendedCommand}
            </code>
          ) : null}
        </CardFooter>
      </Card>
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
