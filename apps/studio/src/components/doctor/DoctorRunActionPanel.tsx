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
import { StudioMutationResultPanel } from "../studio/StudioMutationResultPanel";

type DoctorRunActionPanelProps = Readonly<{
  compact?: boolean;
}>;

/**
 * Renders the guarded Studio action that refreshes local producer doctor diagnostics.
 *
 * @param compact - Whether to use compact copy for home-page placement.
 */
export function DoctorRunActionPanel({ compact = false }: DoctorRunActionPanelProps) {
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const { state, submit } = useStudioGuardedActionSubmit(
    "Refreshes local doctor diagnostics through the canonical producer CLI.",
  );

  async function submitDoctorRun(): Promise<void> {
    setConfirmationOpen(false);
    await submit({
      actionId: "doctor.run",
      body: {},
      errorToastTitle: "Doctor diagnostics were blocked",
      fallbackError: "Doctor diagnostics could not complete.",
      routePath: "/actions/run-doctor",
      submittingMessage: "Running local doctor diagnostics...",
      successMessage: "Doctor diagnostics refreshed. Studio is reloading local health evidence.",
      successToastTitle: "Doctor diagnostics refreshed",
    });
  }

  return (
    <div className={compact ? "doctor-run-action compact" : "doctor-run-action"}>
      <Button
        disabled={state.kind === "submitting"}
        type='button'
        variant={compact ? "secondary" : "default"}
        onClick={() => setConfirmationOpen(true)}
      >
        {state.kind === "submitting" ? "Running doctor..." : "Run doctor"}
      </Button>
      {state.kind !== "idle" ? <StudioMutationResultPanel state={state} /> : null}
      <Dialog open={confirmationOpen} onOpenChange={setConfirmationOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run local doctor diagnostics</DialogTitle>
            <DialogDescription>
              Studio will call `pnpm producer doctor` through the guarded same-origin route. The
              command may write local diagnostics artifacts and can still block on invalid config,
              provider downtime, missing tools, or unsafe publish defaults.
            </DialogDescription>
          </DialogHeader>
          <dl className='grid gap-3 text-sm sm:grid-cols-2'>
            <div>
              <dt className='font-medium text-muted-foreground'>Action</dt>
              <dd className='break-all'>doctor.run</dd>
            </div>
            <div>
              <dt className='font-medium text-muted-foreground'>Route</dt>
              <dd className='break-all'>/actions/run-doctor</dd>
            </div>
            <div>
              <dt className='font-medium text-muted-foreground'>CLI equivalent</dt>
              <dd className='break-all'>pnpm producer doctor</dd>
            </div>
            <div>
              <dt className='font-medium text-muted-foreground'>Boundary</dt>
              <dd>No config edits, provider startup, model download, upload, or publish action.</dd>
            </div>
          </dl>
          <DialogFooter showCloseButton>
            <Button
              disabled={state.kind === "submitting"}
              type='button'
              onClick={() => void submitDoctorRun()}
            >
              Run doctor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
