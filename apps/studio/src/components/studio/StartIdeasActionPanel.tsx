"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { StartIdeasReadinessSummary } from "@/lib/startIdeasReadiness";
import { useStudioGuardedActionSubmit } from "@/lib/useStudioGuardedActionSubmit";
import { StudioMutationResultPanel } from "./StudioMutationResultPanel";

type StartIdeasActionPanelProps = Readonly<{
  buttonLabel?: string;
  description?: string;
  readiness?: StartIdeasReadinessSummary;
}>;

/**
 * Renders the guarded Studio action that starts a local idea-generation run.
 *
 * @param buttonLabel - The visible button label for the current surface.
 * @param description - Optional operator-facing copy shown above the action button.
 * @param readiness - Read-only doctor-derived provider readiness guidance.
 */
export function StartIdeasActionPanel({
  buttonLabel = "Start ideas run",
  description,
  readiness,
}: StartIdeasActionPanelProps) {
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const { state, submit } = useStudioGuardedActionSubmit(
    "Idea generation starts a new local run through the canonical producer CLI.",
  );

  async function submitIdeasRun(): Promise<void> {
    setConfirmationOpen(false);
    await submit({
      actionId: "ideas.run",
      body: {},
      errorToastTitle: "Idea generation was blocked",
      fallbackError: "Idea generation could not complete.",
      routePath: "/actions/run-ideas",
      submittingMessage: "Starting local idea generation...",
      successMessage: "Idea run created. Studio is refreshing the local queue.",
      successToastTitle: "Idea run created",
    });
  }

  return (
    <div className='grid gap-4'>
      {description ? <p className='text-sm text-muted-foreground'>{description}</p> : null}
      {readiness ? <StartIdeasReadinessNotice readiness={readiness} /> : null}
      <Button
        disabled={state.kind === "submitting"}
        type='button'
        onClick={() => setConfirmationOpen(true)}
      >
        {state.kind === "submitting" ? "Starting..." : buttonLabel}
      </Button>
      <StudioMutationResultPanel state={state} />
      <Dialog open={confirmationOpen} onOpenChange={setConfirmationOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm local idea generation</DialogTitle>
            <DialogDescription>
              Studio will call `pnpm producer ideas` through the guarded local route. Provider
              config, budget, parser, and failure guards remain enforced by CLI/core. Upload and
              publish are not available here.
            </DialogDescription>
          </DialogHeader>
          <div className='rounded-lg border bg-muted/30 p-4'>
            <dl className='grid gap-3 text-sm sm:grid-cols-2'>
              <div className='space-y-1'>
                <dt className='font-medium text-muted-foreground'>Action</dt>
                <dd>ideas.run</dd>
              </div>
              <div className='space-y-1'>
                <dt className='font-medium text-muted-foreground'>Route</dt>
                <dd className='break-all'>/actions/run-ideas</dd>
              </div>
              <div className='space-y-1'>
                <dt className='font-medium text-muted-foreground'>CLI equivalent</dt>
                <dd className='break-all'>pnpm producer ideas</dd>
              </div>
              {readiness ? (
                <div className='space-y-1'>
                  <dt className='font-medium text-muted-foreground'>Doctor context</dt>
                  <dd>{readiness.label}</dd>
                </div>
              ) : null}
            </dl>
          </div>
          <DialogFooter showCloseButton>
            <Button
              disabled={state.kind === "submitting"}
              type='button'
              onClick={() => void submitIdeasRun()}
            >
              {buttonLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StartIdeasReadinessNotice({
  readiness,
}: Readonly<{ readiness: StartIdeasReadinessSummary }>) {
  return (
    <div
      className='grid gap-2 rounded-lg bg-muted/20 p-3 text-sm ring-1 ring-border/10'
      data-tone={readiness.tone}
    >
      <div className='flex flex-wrap items-center gap-2'>
        <strong>{readiness.label}</strong>
        <Badge variant={readiness.tone === "blocked" ? "destructive" : "secondary"}>
          {readiness.tone}
        </Badge>
      </div>
      <span className='text-muted-foreground'>{readiness.detail}</span>
      {readiness.nextAction ? (
        <code className='max-w-full break-all rounded-md bg-background px-2 py-1 text-xs text-muted-foreground'>
          {readiness.nextAction}
        </code>
      ) : null}
    </div>
  );
}
