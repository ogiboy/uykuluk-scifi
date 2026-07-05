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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { StudioRunDetail } from "@/lib/runSummaries";
import { buildStudioActionPreflight } from "@/lib/studioActionPreflight";
import { useStudioGuardedActionSubmit } from "@/lib/useStudioGuardedActionSubmit";
import { StudioMutationResultPanel } from "../studio/StudioMutationResultPanel";
import { RunActionPreflightPanel } from "./RunActionPreflightPanel";
import {
  RunChannelHandoffDecisionSelector,
  type ChannelHandoffDecisionValue,
} from "./RunChannelHandoffDecisionSelector";

type PendingChannelHandoffDecisionPayload = Readonly<{
  decision: ChannelHandoffDecisionValue;
  notes: string;
  reviewedBy: string;
  runId: string;
  thumbnailCandidateId?: string;
}>;

type RunChannelHandoffDecisionActionPanelProps = Readonly<{
  run: StudioRunDetail;
}>;

/**
 * Renders the guarded Studio form for recording one manual channel-handoff decision.
 *
 * @param run - The run detail projection with trusted handoff status.
 */
export function RunChannelHandoffDecisionActionPanel({
  run,
}: RunChannelHandoffDecisionActionPanelProps) {
  const presentChannelHandoff = run.channelHandoff.kind === "present" ? run.channelHandoff : null;
  const actionAvailable =
    presentChannelHandoff !== null && run.channelHandoffDecision.kind === "missing";
  const recommendedCandidateId = actionAvailable
    ? presentChannelHandoff.handoff.thumbnailCandidates.recommendedCandidateId
    : "";
  const [decision, setDecision] = useState<ChannelHandoffDecisionValue>(
    "accepted-for-manual-channel-prep",
  );
  const [notes, setNotes] = useState("");
  const [reviewedBy, setReviewedBy] = useState("operator");
  const [thumbnailCandidateId, setThumbnailCandidateId] = useState(recommendedCandidateId);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<PendingChannelHandoffDecisionPayload | null>(
    null,
  );
  const { state, submit } = useStudioGuardedActionSubmit(
    "Records local channel-prep evidence only. Upload and publish stay disabled.",
  );

  if (!actionAvailable) {
    return null;
  }

  const preflight = buildStudioActionPreflight({
    actionId: "channel-handoff.decide",
    run,
  });
  const candidateRequired = decision === "accepted-for-manual-channel-prep";
  const trimmedCandidateId = thumbnailCandidateId.trim();
  const formReady =
    reviewedBy.trim().length > 0 &&
    notes.trim().length > 0 &&
    (!candidateRequired || trimmedCandidateId.length > 0);

  function requestDecisionConfirmation(event: { preventDefault: () => void }): void {
    event.preventDefault();
    if (!formReady) return;
    setPendingPayload({
      decision,
      notes,
      reviewedBy,
      runId: run.runId,
      ...(candidateRequired ? { thumbnailCandidateId: trimmedCandidateId } : {}),
    });
    setConfirmationOpen(true);
  }

  async function confirmDecision(): Promise<void> {
    if (!pendingPayload) return;
    setConfirmationOpen(false);
    await submit({
      actionId: "channel-handoff.decide",
      body: pendingPayload,
      errorToastTitle: "Channel handoff decision was not recorded",
      fallbackError: "Channel handoff decision could not be recorded.",
      routePath: "/actions/decide-channel-handoff",
      submittingMessage: "Recording local channel handoff decision...",
      successMessage:
        "Channel handoff decision recorded. Updating the run detail from persisted local evidence.",
      successToastTitle: "Channel handoff decision recorded",
    });
    setPendingPayload(null);
  }

  return (
    <section className='panel' aria-labelledby='channel-handoff-decision-action-heading'>
      <h2 id='channel-handoff-decision-action-heading'>Record Channel Handoff Decision</h2>
      <p>
        This guarded Studio action writes the same local decision evidence as the CLI. It does not
        upload media, schedule a video, or approve public publish.
      </p>
      <RunActionPreflightPanel preflight={preflight} />
      <form className='studio-form' onSubmit={requestDecisionConfirmation}>
        <RunChannelHandoffDecisionSelector decision={decision} onDecisionChange={setDecision} />
        <label>
          Thumbnail candidate
          <Input
            disabled={!candidateRequired}
            maxLength={120}
            required={candidateRequired}
            value={thumbnailCandidateId}
            onChange={(event) => setThumbnailCandidateId(event.target.value)}
          />
          <span className='field-help'>
            Recommended candidate: {recommendedCandidateId}. Required only for accepted channel
            prep.
          </span>
        </label>
        <label>
          Reviewed by
          <Input
            maxLength={200}
            minLength={1}
            required
            value={reviewedBy}
            onChange={(event) => setReviewedBy(event.target.value)}
          />
        </label>
        <label>
          Notes
          <Textarea
            className='resize-y'
            maxLength={4000}
            minLength={1}
            required
            rows={4}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
        <Button disabled={state.kind === "submitting" || !formReady} type='submit'>
          Record local channel decision
        </Button>
      </form>
      <Dialog open={confirmationOpen} onOpenChange={setConfirmationOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm local channel handoff decision</DialogTitle>
            <DialogDescription>
              This writes local review evidence for {run.runId}. Upload and public publish stay
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
                <dt>Thumbnail</dt>
                <dd>{pendingPayload?.thumbnailCandidateId ?? "not selected for this decision"}</dd>
              </div>
              <div>
                <dt>Reviewed by</dt>
                <dd>{pendingPayload?.reviewedBy ?? reviewedBy}</dd>
              </div>
              <div>
                <dt>Run</dt>
                <dd>{run.runId}</dd>
              </div>
            </dl>
            <p className='artifact-action'>
              Notes are required and will be persisted with the local channel handoff decision.
            </p>
          </div>
          <DialogFooter showCloseButton>
            <Button disabled={state.kind === "submitting"} type='button' onClick={confirmDecision}>
              Confirm local decision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <StudioMutationResultPanel state={state} />
      {run.channelHandoffDecision.nextAction ? (
        <p className='artifact-action'>CLI equivalent: {run.channelHandoffDecision.nextAction}</p>
      ) : null}
    </section>
  );
}
