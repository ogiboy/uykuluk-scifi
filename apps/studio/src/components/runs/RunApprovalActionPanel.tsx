"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { StudioRunDetail } from "@/lib/runSummaries";
import {
  approvalActionForRun,
  approvalFormReady,
  approvalPayload,
} from "@/lib/studioApprovalAction";
import { buildStudioActionPreflight } from "@/lib/studioActionPreflight";
import { useStudioGuardedActionSubmit } from "@/lib/useStudioGuardedActionSubmit";
import { RunActionPreflightPanel } from "./RunActionPreflightPanel";
import { RunApprovalConfirmationDialog } from "./RunApprovalConfirmationDialog";
import { RunIdeaApprovalSelector } from "./RunIdeaApprovalSelector";

type RunApprovalActionPanelProps = Readonly<{
  run: Pick<
    StudioRunDetail,
    | "blockedActionCount"
    | "evidenceMessage"
    | "evidenceStatus"
    | "generatedIdeas"
    | "nextRecommendedCommand"
    | "readinessMessage"
    | "readinessStatus"
    | "runId"
    | "state"
  >;
}>;

type FormSubmitEvent = Readonly<{
  preventDefault: () => void;
}>;

/**
 * Renders guarded Studio approval forms for local workflow approval gates.
 *
 * @param run - The current run summary.
 */
export function RunApprovalActionPanel({ run }: RunApprovalActionPanelProps) {
  const config = approvalActionForRun(run);
  const [ideaId, setIdeaId] = useState(run.generatedIdeas[0]?.id ?? "");
  const [acknowledgeWarnings, setAcknowledgeWarnings] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<Record<string, boolean | string> | null>(
    null,
  );
  const { state, submit } = useStudioGuardedActionSubmit(
    "Records explicit local approval evidence only. Upload and publish stay disabled.",
  );

  if (!config) {
    return null;
  }

  const preflight = buildStudioActionPreflight({
    acknowledgeWarnings,
    actionId: config.actionId,
    run,
    selectedIdeaId: ideaId,
  });

  function requestApprovalConfirmation(event: FormSubmitEvent): void {
    event.preventDefault();
    if (!config) return;
    setPendingPayload(approvalPayload(config.actionId, run.runId, ideaId, acknowledgeWarnings));
    setConfirmationOpen(true);
  }

  async function confirmApproval(): Promise<void> {
    if (!config || !pendingPayload) return;
    setConfirmationOpen(false);
    await submit({
      actionId: config.actionId,
      body: pendingPayload,
      errorToastTitle: "Approval was not recorded",
      fallbackError: "Approval could not be recorded.",
      routePath: config.routePath,
      submittingMessage: "Recording local approval...",
      successMessage: "Approval recorded. Updating the run detail from persisted local state.",
      successToastTitle: "Approval recorded",
    });
    setPendingPayload(null);
  }

  return (
    <section className='panel' aria-labelledby='approval-action-heading'>
      <h2 id='approval-action-heading'>{config.heading}</h2>
      <p>{config.description}</p>
      <p>
        This guarded Studio action uses the same CLI/core approval gate as the copy-paste command.
      </p>
      <RunActionPreflightPanel preflight={preflight} />
      <form className='studio-form' onSubmit={requestApprovalConfirmation}>
        {config.actionId === "idea.approve" ? (
          <RunIdeaApprovalSelector
            ideas={run.generatedIdeas}
            ideaId={ideaId}
            onIdeaIdChange={setIdeaId}
          />
        ) : null}
        {config.actionId === "script.approve" ? (
          <label className='checkbox-label'>
            <Checkbox
              checked={acknowledgeWarnings}
              onCheckedChange={(checked) => setAcknowledgeWarnings(checked === true)}
            />
            Acknowledge non-blocking script review warnings if present
          </label>
        ) : null}
        <Button
          disabled={state.kind === "submitting" || !approvalFormReady(config, ideaId)}
          type='submit'
        >
          {config.buttonLabel}
        </Button>
      </form>
      <RunApprovalConfirmationDialog
        actionId={config.actionId}
        buttonLabel={config.buttonLabel}
        currentState={run.state}
        isSubmitting={state.kind === "submitting"}
        nextRecommendedCommand={run.nextRecommendedCommand}
        open={confirmationOpen}
        pendingPayload={pendingPayload}
        runId={run.runId}
        onConfirm={confirmApproval}
        onOpenChange={setConfirmationOpen}
      />
      <p className={state.kind === "error" ? "blocked" : undefined}>{state.message}</p>
      {run.nextRecommendedCommand ? (
        <p className='artifact-action'>CLI equivalent: {run.nextRecommendedCommand}</p>
      ) : null}
    </section>
  );
}
