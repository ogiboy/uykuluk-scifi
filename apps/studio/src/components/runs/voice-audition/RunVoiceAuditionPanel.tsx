"use client";
import { StudioMutationResultPanel } from "@/components/studio/StudioMutationResultPanel";
import { useStudioGuardedActionSubmit } from "@/lib/mutations/useStudioGuardedActionSubmit";
import type {
  StudioVoiceAuditionActionBinding,
  StudioVoiceAuditionSummary,
} from "@/lib/runs/voiceAuditionSummaries";
import {
  isStudioHostedVoiceExecutionConfirmed,
  studioHostedVoiceExecutionIdentity,
} from "@/lib/runs/voiceAuditionSummaryTypes";
import { useState } from "react";
import { RunDetailCard } from "../RunDetailCard";
import { RunVoiceAuditionHeader } from "./RunVoiceAuditionHeader";
import { RunVoiceCandidateGrid } from "./RunVoiceCandidateGrid";
import { RunVoiceEvidenceSummary } from "./RunVoiceEvidenceSummary";
import { VoiceProductionExecutionControl } from "./VoiceProductionExecutionControl";
import { VoiceReselectionControl } from "./VoiceReselectionControl";
import { VoiceSelectionForm } from "./VoiceSelectionForm";

type RunVoiceAuditionPanelProps = Readonly<{ runId: string; summary: StudioVoiceAuditionSummary }>;

/** Renders the explicit operator-triggered voice audition and production evidence flow. */
export function RunVoiceAuditionPanel({ runId, summary }: RunVoiceAuditionPanelProps) {
  const [compareVoiceIds, setCompareVoiceIds] = useState<string[]>([]);
  const [selectionVoiceId, setSelectionVoiceId] = useState<string | null>(null);
  const [reviewedBy, setReviewedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmProductionRights, setConfirmProductionRights] = useState(false);
  const [confirmedProductionIdentity, setConfirmedProductionIdentity] = useState<string | null>(
    null,
  );
  const [reselectionOpen, setReselectionOpen] = useState(false);
  const [reselectionReviewer, setReselectionReviewer] = useState("");
  const [reselectionReason, setReselectionReason] = useState("");
  const { state, submit } = useStudioGuardedActionSubmit(
    "Voice actions remain idle until the operator requests one.",
  );
  const busy = state.kind === "submitting";
  const chosenCandidate = summary.candidates.find((item) => item.voiceId === selectionVoiceId);
  const currentProductionIdentity = studioHostedVoiceExecutionIdentity(
    summary.production.hostedExecution,
  );
  const confirmPaidOperation = isStudioHostedVoiceExecutionConfirmed(
    summary.production.hostedExecution,
    confirmedProductionIdentity,
  );

  async function runAction(
    binding: StudioVoiceAuditionActionBinding | null,
    body: unknown,
    messages: Readonly<{ pending: string; success: string; title: string }>,
  ): Promise<void> {
    if (!binding) return;
    await submit({
      actionId: binding.actionId,
      body,
      errorToastTitle: `${messages.title} blocked`,
      fallbackError: `${messages.title} could not complete.`,
      routePath: binding.routePath,
      submittingMessage: messages.pending,
      successMessage: messages.success,
      successToastTitle: `${messages.title} completed`,
    });
  }

  function toggleComparison(voiceId: string): void {
    setCompareVoiceIds((current) => {
      if (current.includes(voiceId)) return current.filter((candidate) => candidate !== voiceId);
      if (current.length < 2) return [...current, voiceId];
      return [current[1]!, voiceId];
    });
  }

  async function requestCandidates(): Promise<void> {
    await runAction(
      summary.actions["voice.candidates"],
      { runId },
      {
        pending: "Fetching and persisting the bounded voice catalog...",
        success: "Voice candidates were persisted. Refreshing the local run projection.",
        title: "Voice catalog",
      },
    );
  }

  async function requestPreview(voiceId: string): Promise<void> {
    await runAction(
      summary.actions["voice.preview"],
      { runId, voiceId },
      {
        pending: "Recording a bounded local voice preview...",
        success: "Voice preview was persisted for local playback.",
        title: "Voice preview",
      },
    );
  }

  async function selectCandidate(): Promise<void> {
    if (!selectionVoiceId || !reviewedBy.trim() || !notes.trim()) return;
    await runAction(
      summary.actions["voice.select"],
      {
        runId,
        voiceId: selectionVoiceId,
        reviewedBy: reviewedBy.trim(),
        notes: notes.trim(),
        confirmProductionRights,
      },
      {
        pending: "Recording the attributable voice selection...",
        success: "Voice selection was persisted. Quote and production gates remain separate.",
        title: "Voice selection",
      },
    );
  }

  async function reselectVoice(): Promise<void> {
    if (!reselectionReviewer.trim() || !reselectionReason.trim()) return;
    await runAction(
      summary.actions["voice.reselect"],
      { runId, reviewedBy: reselectionReviewer.trim(), reason: reselectionReason.trim() },
      {
        pending: "Archiving the unspent voice selection and quote evidence...",
        success: "Prior voice evidence was archived and the explicit selection gate reopened.",
        title: "Voice reselection",
      },
    );
  }

  async function runProductionVoice(): Promise<void> {
    const confirmation = summary.production.hostedExecution;
    const hosted = summary.executionMode === "hosted";
    if (hosted && (!confirmation || !confirmPaidOperation)) return;
    await runAction(
      summary.actions["voice.run"],
      hosted
        ? { executionMode: "hosted", runId, ...confirmation, confirmPaidOperation: true }
        : { runId },
      {
        pending: "Revalidating and executing the exact approved production voice operation...",
        success: "Production voice and timing evidence were persisted for review.",
        title: "Production voice",
      },
    );
  }

  return (
    <RunDetailCard
      headingId='voice-audition-heading'
      title='Voice Audition And Production'
      description='Compare persisted Turkish-capable previews, record an attributable selection, then inspect quote, quota, synthesis, and alignment gates without leaving Studio.'
    >
      <RunVoiceAuditionHeader
        busy={busy}
        summary={summary}
        onRequestCandidates={() => void requestCandidates()}
      />
      <StudioMutationResultPanel state={state} />

      <RunVoiceCandidateGrid
        busy={busy}
        candidates={summary.candidates}
        compareVoiceIds={compareVoiceIds}
        previewActionAvailable={Boolean(summary.actions["voice.preview"])}
        runId={runId}
        selectActionAvailable={Boolean(summary.actions["voice.select"])}
        onChoose={setSelectionVoiceId}
        onCompare={toggleComparison}
        onPreview={(voiceId) => void requestPreview(voiceId)}
      />

      {chosenCandidate ? (
        <VoiceSelectionForm
          busy={busy}
          candidateName={chosenCandidate.name}
          confirmProductionRights={confirmProductionRights}
          notes={notes}
          reviewedBy={reviewedBy}
          submitAvailable={Boolean(summary.actions["voice.select"])}
          onCancel={() => setSelectionVoiceId(null)}
          onConfirmProductionRightsChange={setConfirmProductionRights}
          onNotesChange={setNotes}
          onReviewedByChange={setReviewedBy}
          onSubmit={() => void selectCandidate()}
        />
      ) : null}

      {summary.currentSelection ? (
        <VoiceReselectionControl
          busy={busy}
          open={reselectionOpen}
          reason={reselectionReason}
          reviewer={reselectionReviewer}
          selection={summary.currentSelection}
          submitAvailable={Boolean(summary.actions["voice.reselect"])}
          onOpenChange={setReselectionOpen}
          onReasonChange={setReselectionReason}
          onReviewerChange={setReselectionReviewer}
          onSubmit={() => void reselectVoice()}
        />
      ) : null}
      <VoiceProductionExecutionControl
        alreadyReady={summary.production.synthesis.status === "ready"}
        busy={busy}
        confirmation={summary.production.hostedExecution}
        confirmed={confirmPaidOperation}
        executionMode={summary.executionMode}
        submitAvailable={Boolean(summary.actions["voice.run"])}
        onConfirmedChange={(checked) =>
          setConfirmedProductionIdentity(checked ? currentProductionIdentity : null)
        }
        onSubmit={() => void runProductionVoice()}
      />

      <RunVoiceEvidenceSummary summary={summary} />
    </RunDetailCard>
  );
}
