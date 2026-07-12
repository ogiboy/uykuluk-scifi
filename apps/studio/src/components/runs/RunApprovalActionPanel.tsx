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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { buildStudioActionPreflight } from "@/lib/actions/studioActionPreflight";
import {
  approvalActionForRun,
  approvalCommandForRun,
  approvalFormReady,
  approvalPayload,
} from "@/lib/actions/studioApprovalAction";
import { useStudioGuardedActionSubmit } from "@/lib/mutations/useStudioGuardedActionSubmit";
import type { StudioRunDetail } from "@/lib/runSummaries";
import { useState } from "react";
import { StudioMutationResultPanel } from "../studio/StudioMutationResultPanel";
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

type FormSubmitEvent = Readonly<{ preventDefault: () => void }>;

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

  const cliEquivalent = approvalCommandForRun(config, run.runId, run.nextRecommendedCommand);
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
    <section aria-labelledby='approval-action-heading'>
      <Card>
        <CardHeader>
          <CardTitle id='approval-action-heading'>{config.heading}</CardTitle>
          <CardDescription>{config.description}</CardDescription>
        </CardHeader>
        <CardContent className='space-y-5'>
          <p className='text-muted-foreground text-sm'>
            This guarded Studio action uses the same CLI/core approval gate as the copy-paste
            command.
          </p>
          <RunActionPreflightPanel preflight={preflight} />
          <form className='space-y-4' onSubmit={requestApprovalConfirmation}>
            {config.actionId === "idea.approve" ? (
              <RunIdeaApprovalSelector
                ideas={run.generatedIdeas}
                ideaId={ideaId}
                onIdeaIdChange={setIdeaId}
              />
            ) : null}
            {config.actionId === "script.approve" ? (
              <Label className='bg-card items-start gap-3 rounded-lg border p-3 text-sm leading-6'>
                <Checkbox
                  aria-label='Acknowledge non-blocking script review warnings'
                  checked={acknowledgeWarnings}
                  onCheckedChange={(checked) => setAcknowledgeWarnings(checked === true)}
                />
                <span>Acknowledge non-blocking script review warnings if present</span>
              </Label>
            ) : null}
            <Button
              disabled={state.kind === "submitting" || !approvalFormReady(config, ideaId)}
              type='submit'
            >
              {config.buttonLabel}
            </Button>
          </form>
          <StudioMutationResultPanel state={state} />
        </CardContent>
        {cliEquivalent ? (
          <CardFooter>
            <code className='bg-muted text-muted-foreground max-w-full rounded-md px-2 py-1 text-xs break-all'>
              CLI equivalent: {cliEquivalent}
            </code>
          </CardFooter>
        ) : null}
      </Card>
      <RunApprovalConfirmationDialog
        actionId={config.actionId}
        buttonLabel={config.buttonLabel}
        currentState={run.state}
        isSubmitting={state.kind === "submitting"}
        nextRecommendedCommand={cliEquivalent}
        open={confirmationOpen}
        pendingPayload={pendingPayload}
        runId={run.runId}
        onConfirm={confirmApproval}
        onOpenChange={setConfirmationOpen}
      />
    </section>
  );
}
