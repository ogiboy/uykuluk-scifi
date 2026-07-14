"use client";
import { useState } from "react";

export function useVoiceSelectionForm() {
  const [compareVoiceIds, setCompareVoiceIds] = useState<string[]>([]);
  const [confirmedProductionIdentity, setConfirmedProductionIdentity] = useState<string | null>(
    null,
  );
  const [selectionVoiceId, setSelectionVoiceId] = useState<string | null>(null);
  const [reviewedBy, setReviewedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmProductionRights, setConfirmProductionRights] = useState(false);

  function resetSelectionEvidence(): void {
    setReviewedBy("");
    setNotes("");
    setConfirmProductionRights(false);
  }

  function chooseCandidate(voiceId: string): void {
    if (voiceId !== selectionVoiceId) resetSelectionEvidence();
    setSelectionVoiceId(voiceId);
  }

  function cancelSelection(): void {
    setSelectionVoiceId(null);
    resetSelectionEvidence();
  }

  function toggleComparison(voiceId: string): void {
    setCompareVoiceIds((current) => {
      if (current.includes(voiceId)) return current.filter((candidate) => candidate !== voiceId);
      if (current.length < 2) return [...current, voiceId];
      return [current[1]!, voiceId];
    });
  }

  return {
    cancelSelection,
    chooseCandidate,
    compareVoiceIds,
    confirmedProductionIdentity,
    confirmProductionRights,
    notes,
    reviewedBy,
    selectionVoiceId,
    setConfirmProductionRights,
    setConfirmedProductionIdentity,
    setNotes,
    setReviewedBy,
    toggleComparison,
  };
}
