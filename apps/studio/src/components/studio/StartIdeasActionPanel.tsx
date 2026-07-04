"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useStudioGuardedActionSubmit } from "@/lib/useStudioGuardedActionSubmit";

type StartIdeasActionPanelProps = Readonly<{
  buttonLabel?: string;
  description?: string;
}>;

/**
 * Renders the guarded Studio action that starts a local idea-generation run.
 *
 * @param buttonLabel - The visible button label for the current surface.
 * @param description - Optional operator-facing copy shown above the action button.
 */
export function StartIdeasActionPanel({
  buttonLabel = "Start ideas run",
  description,
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
    <div className='start-ideas-action'>
      {description ? <p>{description}</p> : null}
      <Button
        disabled={state.kind === "submitting"}
        type='button'
        onClick={() => setConfirmationOpen(true)}
      >
        {state.kind === "submitting" ? "Starting..." : buttonLabel}
      </Button>
      <p className={state.kind === "error" || state.kind === "blocked" ? "blocked" : undefined}>
        {state.message}
      </p>
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
          <div className='confirmation-summary'>
            <dl className='decision-list'>
              <div>
                <dt>Action</dt>
                <dd>ideas.run</dd>
              </div>
              <div>
                <dt>Route</dt>
                <dd>/actions/run-ideas</dd>
              </div>
              <div>
                <dt>CLI equivalent</dt>
                <dd>pnpm producer ideas</dd>
              </div>
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
