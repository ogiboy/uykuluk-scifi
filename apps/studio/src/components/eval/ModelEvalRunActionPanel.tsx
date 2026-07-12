"use client";

import { useState } from "react";

import { StudioMutationResultPanel } from "@/components/studio/StudioMutationResultPanel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useStudioGuardedActionSubmit } from "@/lib/mutations/useStudioGuardedActionSubmit";

/**
 * Renders the guarded Studio action that refreshes single-model local eval evidence.
 */
export function ModelEvalRunActionPanel() {
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const { state, submit } = useStudioGuardedActionSubmit(
    "Runs the single-model local parser-contract eval through the canonical producer CLI.",
  );

  async function runModelEval(): Promise<void> {
    setConfirmationOpen(false);
    await submit({
      actionId: "model-eval.run",
      body: {},
      errorToastTitle: "Local model evaluation was blocked",
      fallbackError: "Local model evaluation could not complete.",
      routePath: "/actions/run-model-eval",
      submittingMessage: "Running single-model local evaluation...",
      successMessage:
        "Local model evaluation refreshed. Studio is reloading diagnostics artifacts.",
      successToastTitle: "Local model evaluation refreshed",
    });
  }

  return (
    <div className='grid gap-3'>
      <Button
        disabled={state.kind === "submitting"}
        type='button'
        onClick={() => setConfirmationOpen(true)}
      >
        {state.kind === "submitting" ? "Running eval..." : "Run single-model eval"}
      </Button>
      {state.kind !== "idle" ? <StudioMutationResultPanel state={state} /> : null}
      <Dialog open={confirmationOpen} onOpenChange={setConfirmationOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run single-model local evaluation</DialogTitle>
            <DialogDescription>
              Studio will call `pnpm producer eval local-model --json` through the guarded
              same-origin route. The command may contact the configured local provider and write
              ignored diagnostics artifacts. It does not edit config, download models, create runs,
              approve stages, upload media, or publish content.
            </DialogDescription>
          </DialogHeader>
          <dl className='grid gap-3 text-sm sm:grid-cols-2'>
            <div>
              <dt className='text-muted-foreground font-medium'>Action</dt>
              <dd className='break-all'>model-eval.run</dd>
            </div>
            <div>
              <dt className='text-muted-foreground font-medium'>Route</dt>
              <dd className='break-all'>/actions/run-model-eval</dd>
            </div>
            <div>
              <dt className='text-muted-foreground font-medium'>CLI equivalent</dt>
              <dd className='break-all'>pnpm producer eval local-model --json</dd>
            </div>
            <div>
              <dt className='text-muted-foreground font-medium'>Boundary</dt>
              <dd>Single configured model only; candidate comparison remains manual for now.</dd>
            </div>
          </dl>
          <DialogFooter showCloseButton>
            <Button
              disabled={state.kind === "submitting"}
              type='button'
              onClick={() => void runModelEval()}
            >
              Run single-model eval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
