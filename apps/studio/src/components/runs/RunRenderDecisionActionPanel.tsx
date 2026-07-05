"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { StudioRunDetail } from "@/lib/runSummaries";
import { buildStudioActionPreflight } from "@/lib/studioActionPreflight";
import { useStudioGuardedActionSubmit } from "@/lib/useStudioGuardedActionSubmit";
import { StudioMutationResultPanel } from "../studio/StudioMutationResultPanel";
import { RunActionPreflightPanel } from "./RunActionPreflightPanel";
import { RunRenderDecisionSelector } from "./RunRenderDecisionSelector";

type RunRenderDecisionActionPanelProps = Readonly<{
  commands: StudioRunDetail["renderDecisionCommands"];
  run: Pick<
    StudioRunDetail,
    | "blockedActionCount"
    | "evidenceMessage"
    | "evidenceStatus"
    | "nextRecommendedCommand"
    | "readinessMessage"
    | "readinessStatus"
    | "runId"
    | "state"
  >;
  runId: string;
}>;

type RenderDecisionValue = StudioRunDetail["renderDecisionCommands"][number]["decision"];

type PendingRenderDecisionPayload = Readonly<{
  decision: RenderDecisionValue;
  notes: string;
  reviewedBy: string;
  runId: string;
}>;

type FormSubmitEvent = Readonly<{
  preventDefault: () => void;
}>;

/**
 * Renders the guarded Studio form for recording one local render decision.
 *
 * @param commands - The allowed render-decision command templates.
 * @param runId - The rendered run that will receive the decision evidence.
 */
export function RunRenderDecisionActionPanel({
  commands,
  run,
  runId,
}: RunRenderDecisionActionPanelProps) {
  const [decision, setDecision] = useState(commands[0]?.decision ?? "accepted-for-local-review");
  const [notes, setNotes] = useState("");
  const [reviewedBy, setReviewedBy] = useState("operator");
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<PendingRenderDecisionPayload | null>(null);
  const reviewedById = useId();
  const notesId = useId();
  const { state, submit } = useStudioGuardedActionSubmit(
    "Records local evidence only. Upload and publish stay disabled.",
  );

  if (commands.length === 0) {
    return null;
  }

  const preflight = buildStudioActionPreflight({
    actionId: "render.decide",
    run,
  });

  function requestDecisionConfirmation(event: FormSubmitEvent): void {
    event.preventDefault();
    setPendingPayload({ decision, notes, reviewedBy, runId });
    setConfirmationOpen(true);
  }

  async function confirmDecision(): Promise<void> {
    if (!pendingPayload) return;
    setConfirmationOpen(false);
    await submit({
      actionId: "render.decide",
      body: pendingPayload,
      errorToastTitle: "Render decision was not recorded",
      fallbackError: "Render decision could not be recorded.",
      routePath: "/actions/decide-render",
      submittingMessage: "Recording local render decision...",
      successMessage:
        "Render decision recorded. Updating the run detail from persisted local evidence.",
      successToastTitle: "Render decision recorded",
    });
    setPendingPayload(null);
  }

  return (
    <Card aria-labelledby='render-decision-action-heading'>
      <CardHeader>
        <CardDescription>Local operator decision</CardDescription>
        <CardTitle>
          <h2 id='render-decision-action-heading'>Record Render Decision</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-6'>
        <p className='text-sm text-muted-foreground'>
          This guarded Studio action writes the same local decision evidence as the CLI. It does not
          approve upload or publish.
        </p>
        <RunActionPreflightPanel preflight={preflight} />
        <form className='space-y-5' onSubmit={requestDecisionConfirmation}>
          <RunRenderDecisionSelector
            commands={commands}
            decision={decision}
            onDecisionChange={setDecision}
          />
          <div className='space-y-2'>
            <Label htmlFor={reviewedById}>Reviewed by</Label>
            <Input
              id={reviewedById}
              maxLength={200}
              minLength={1}
              required
              value={reviewedBy}
              onChange={(event) => setReviewedBy(event.target.value)}
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor={notesId}>Notes</Label>
            <Textarea
              id={notesId}
              className='min-h-28 resize-y'
              maxLength={4000}
              minLength={1}
              required
              rows={4}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
          <Button disabled={state.kind === "submitting"} type='submit'>
            Record local decision
          </Button>
        </form>
      </CardContent>
      <Dialog open={confirmationOpen} onOpenChange={setConfirmationOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm local render decision</DialogTitle>
            <DialogDescription>
              This writes local review evidence for {runId}. Upload and public publish stay
              disabled.
            </DialogDescription>
          </DialogHeader>
          <div className='confirmation-summary'>
            <dl className='decision-list'>
              <div>
                <dt>Decision</dt>
                <dd>{pendingPayload?.decision ?? decision}</dd>
              </div>
              <div>
                <dt>Reviewed by</dt>
                <dd>{pendingPayload?.reviewedBy ?? reviewedBy}</dd>
              </div>
              <div>
                <dt>Run</dt>
                <dd>{runId}</dd>
              </div>
            </dl>
            <p className='artifact-action'>
              Notes are required and will be persisted with the local decision evidence.
            </p>
          </div>
          <DialogFooter showCloseButton>
            <Button disabled={state.kind === "submitting"} type='button' onClick={confirmDecision}>
              Confirm local decision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CardContent>
        <StudioMutationResultPanel state={state} />
      </CardContent>
    </Card>
  );
}
