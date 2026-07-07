"use client";

import { Badge } from "@/components/ui/badge";
import { Button, type ButtonProps } from "@/components/ui/button";
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
import { useState } from "react";
import { StudioMutationResultPanel } from "./StudioMutationResultPanel";

type StartIdeasActionPanelProps = Readonly<{
  buttonLabel?: string;
  description?: string;
  presentation?: "button" | "panel";
  readiness?: StartIdeasReadinessSummary;
  showResult?: boolean;
  variant?: ButtonProps["variant"];
}>;

/**
 * Renders the guarded Studio action that starts a local idea-generation run.
 *
 * @param buttonLabel - The visible button label for the current surface.
 * @param description - Optional operator-facing copy shown above the action button.
 * @param presentation - Whether to render a full panel or a compact button-only control.
 * @param readiness - Read-only doctor-derived provider readiness guidance.
 * @param showResult - Whether to render the mutation result panel.
 * @param variant - The shadcn button variant for the trigger.
 */
export function StartIdeasActionPanel({
  buttonLabel = "Start ideas run",
  description,
  presentation = "panel",
  readiness,
  showResult = true,
  variant = "default",
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

  const isSubmitting = state.kind === "submitting";
  const actionButton = (
    <Button
      disabled={isSubmitting}
      type='button'
      variant={variant}
      onClick={() => setConfirmationOpen(true)}
    >
      {isSubmitting ? "Starting..." : buttonLabel}
    </Button>
  );
  const confirmationDialog = (
    <StartIdeasConfirmationDialog
      buttonLabel={buttonLabel}
      isSubmitting={isSubmitting}
      open={confirmationOpen}
      readiness={readiness}
      onConfirm={() => void submitIdeasRun()}
      onOpenChange={setConfirmationOpen}
    />
  );

  if (presentation === "button") {
    return (
      <>
        {actionButton}
        {confirmationDialog}
      </>
    );
  }

  return (
    <div className='grid gap-4'>
      {description ? <p className='text-muted-foreground text-sm'>{description}</p> : null}
      {readiness ? <StartIdeasReadinessNotice readiness={readiness} /> : null}
      {actionButton}
      {showResult ? <StudioMutationResultPanel state={state} /> : null}
      {confirmationDialog}
    </div>
  );
}

type StartIdeasConfirmationDialogProps = Readonly<{
  buttonLabel: string;
  isSubmitting: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  readiness?: StartIdeasReadinessSummary;
}>;

/**
 * Confirms the global idea-generation action before Studio starts a new local run.
 *
 * @param props - Dialog state, submit callback, and doctor-derived readiness copy.
 */
function StartIdeasConfirmationDialog({
  buttonLabel,
  isSubmitting,
  onConfirm,
  onOpenChange,
  open,
  readiness,
}: StartIdeasConfirmationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm local idea generation</DialogTitle>
          <DialogDescription>
            Studio will call `pnpm producer ideas` through the guarded local route. Provider config,
            budget, parser, and failure guards remain enforced by CLI/core. Upload and publish are
            not available here.
          </DialogDescription>
        </DialogHeader>
        <div className='bg-muted/30 rounded-lg border p-4'>
          <dl className='grid gap-3 text-sm sm:grid-cols-2'>
            <div className='space-y-1'>
              <dt className='text-muted-foreground font-medium'>Action</dt>
              <dd>ideas.run</dd>
            </div>
            <div className='space-y-1'>
              <dt className='text-muted-foreground font-medium'>Route</dt>
              <dd className='break-all'>/actions/run-ideas</dd>
            </div>
            <div className='space-y-1'>
              <dt className='text-muted-foreground font-medium'>CLI equivalent</dt>
              <dd className='break-all'>pnpm producer ideas</dd>
            </div>
            {readiness ? (
              <div className='space-y-1'>
                <dt className='text-muted-foreground font-medium'>Doctor context</dt>
                <dd>{readiness.label}</dd>
              </div>
            ) : null}
          </dl>
        </div>
        <DialogFooter showCloseButton>
          <Button disabled={isSubmitting} type='button' onClick={onConfirm}>
            {buttonLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StartIdeasReadinessNotice({
  readiness,
}: Readonly<{ readiness: StartIdeasReadinessSummary }>) {
  return (
    <div
      className='bg-muted/20 ring-border/10 grid gap-2 rounded-lg p-3 text-sm ring-1'
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
        <code className='bg-background text-muted-foreground max-w-full rounded-md px-2 py-1 text-xs break-all'>
          {readiness.nextAction}
        </code>
      ) : null}
    </div>
  );
}
