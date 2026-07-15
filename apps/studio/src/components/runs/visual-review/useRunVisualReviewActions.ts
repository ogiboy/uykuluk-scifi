"use client";

import { useStudioGuardedActionSubmit } from "@/lib/mutations/useStudioGuardedActionSubmit";
import type { StudioVisualSummary } from "@/lib/runs/visualSummaries";
import { useState } from "react";
import { visualFileProblem } from "./visualFileValidation";
import { encodeVisualImportFile } from "./visualImportFile";

export function useRunVisualReviewActions(runId: string, summary: StudioVisualSummary) {
  const { reportError, state, submit } = useStudioGuardedActionSubmit(
    "Visual actions are explicit and refresh persisted run evidence after completion.",
  );
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [reviewedBy, setReviewedBy] = useState("operator");
  const [notes, setNotes] = useState("Reviewed in the Studio visual contact sheet.");
  const [fileError, setFileError] = useState<string | null>(null);
  const [confirmedHostedIdentity, setConfirmedHostedIdentity] = useState<string | null>(null);
  const busy = state.kind === "submitting";
  const selectedRejectedCount = summary.scenes.filter(
    (scene) => scene.decision === "rejected" && selected.has(scene.sceneIndex),
  ).length;
  const selectedHostedEligibleCount = summary.hosted.eligibleRejectedSceneIndexes.filter(
    (sceneIndex) => selected.has(sceneIndex),
  ).length;
  const hostedSelectionBlocked =
    summary.hosted.allowedPlanPurpose === "regenerate-rejected" &&
    selected.size > 0 &&
    selectedHostedEligibleCount !== selected.size;

  async function prepare(): Promise<void> {
    const action = summary.actions["visuals.prepare"];
    if (!action) return;
    await submit({
      actionId: action.actionId,
      body: { runId },
      errorToastTitle: "Visual preparation blocked",
      fallbackError: "Studio could not prepare scene visuals.",
      routePath: action.routePath,
      submittingMessage: "Preparing deterministic scene visuals...",
      successMessage: "Scene visuals were prepared and are ready for review.",
      successToastTitle: "Visuals prepared",
    });
  }

  async function decide(status: "approved" | "rejected"): Promise<void> {
    const action = summary.actions["visuals.decide"];
    if (!action || selected.size === 0 || !summary.manifestDigest) return;
    const result = await submit({
      actionId: action.actionId,
      body: {
        expectedActiveRevisions: summary.activeRevisions,
        expectedManifestDigest: summary.manifestDigest,
        notes,
        reviewedBy,
        runId,
        sceneIndexes: [...selected],
        status,
      },
      errorToastTitle: "Visual decision blocked",
      fallbackError: "Studio could not record the visual decision.",
      routePath: action.routePath,
      submittingMessage: `Recording ${status} for ${selected.size} visual beats...`,
      successMessage: `Recorded ${status} for ${selected.size} visual beats.`,
      successToastTitle: "Visual decision recorded",
    });
    if (result.kind === "success") setSelected(new Set());
  }

  async function importVisual(sceneIndex: number, file: File): Promise<boolean> {
    const action = summary.actions["visuals.import"];
    if (!action || !summary.manifestDigest) return false;
    const problem = visualFileProblem(file);
    if (problem) {
      setFileError(problem);
      return false;
    }
    const contentBase64 = await encodeVisualImportFile(file, action, setFileError, reportError);
    if (!contentBase64) return false;
    const result = await submit({
      actionId: action.actionId,
      body: {
        contentBase64,
        expectedActiveRevisions: summary.activeRevisions,
        expectedManifestDigest: summary.manifestDigest,
        runId,
        sceneIndex,
        sourceFileName: file.name,
      },
      errorToastTitle: "Visual import blocked",
      fallbackError: "Studio could not import the visual revision.",
      routePath: action.routePath,
      submittingMessage: `Importing visual beat ${sceneIndex}...`,
      successMessage: `Visual beat ${sceneIndex} now has a new pending revision.`,
      successToastTitle: "Visual revision imported",
    });
    if (result.kind !== "success") return false;
    setFileError(null);
    return true;
  }

  async function regenerateRejected(): Promise<void> {
    const action = summary.actions["visuals.regenerate"];
    if (!action || !summary.manifestDigest) return;
    const sceneIndexes = summary.scenes
      .filter((scene) => scene.decision === "rejected" && selected.has(scene.sceneIndex))
      .map((scene) => scene.sceneIndex);
    if (sceneIndexes.length === 0) return;
    const result = await submit({
      actionId: action.actionId,
      body: {
        expectedActiveRevisions: summary.activeRevisions,
        expectedManifestDigest: summary.manifestDigest,
        runId,
        sceneIndexes,
      },
      errorToastTitle: "Visual regeneration blocked",
      fallbackError: "Studio could not regenerate the rejected visual beats.",
      routePath: action.routePath,
      submittingMessage: `Regenerating ${sceneIndexes.length} rejected visual beats...`,
      successMessage: `Regenerated ${sceneIndexes.length} rejected visual beats as pending revisions.`,
      successToastTitle: "Rejected visuals regenerated",
    });
    if (result.kind === "success") setSelected(new Set());
  }

  async function planHosted(): Promise<void> {
    const action = summary.actions["visuals.plan-hosted"];
    const purpose = summary.hosted.allowedPlanPurpose;
    if (!action || !purpose || selected.size === 0) return;
    if (hostedSelectionBlocked) {
      reportError({
        actionId: action.actionId,
        message: "This workflow state can only plan rejected hosted beats for regeneration.",
        routePath: action.routePath,
        toastTitle: "Hosted visual selection blocked",
      });
      return;
    }
    if (purpose === "regenerate-rejected" && (!reviewedBy.trim() || !notes.trim())) {
      reportError({
        actionId: action.actionId,
        message: "Reviewer attribution and revision notes are required for hosted regeneration.",
        routePath: action.routePath,
        toastTitle: "Hosted visual attribution required",
      });
      return;
    }
    await submit({
      actionId: action.actionId,
      body: {
        expectedActiveRevisions:
          purpose === "regenerate-rejected" ? summary.activeRevisions : undefined,
        expectedManifestDigest:
          purpose === "regenerate-rejected" ? summary.manifestDigest : undefined,
        purpose,
        reason: purpose === "regenerate-rejected" ? notes.trim() : undefined,
        reviewedBy: purpose === "regenerate-rejected" ? reviewedBy.trim() : undefined,
        runId,
        sceneIndexes: [...selected],
      },
      errorToastTitle: "Hosted visual plan blocked",
      fallbackError: "Studio could not persist the selected FLUX.2 Pro plan.",
      routePath: action.routePath,
      submittingMessage:
        purpose === "regenerate-rejected"
          ? `Archiving prior evidence and planning ${selected.size} rejected visual beats...`
          : `Binding ${selected.size} visual beats to an exact hosted plan...`,
      successMessage:
        purpose === "regenerate-rejected"
          ? "Rejected hosted beats reopened with revision evidence. Continue with estimate and approval."
          : "Hosted visual plan persisted. Continue with estimate and approval.",
      successToastTitle: "Hosted visual plan ready",
    });
  }

  async function generateHosted(): Promise<void> {
    const action = summary.actions["visuals.generate-hosted"];
    const execution = summary.hosted.execution;
    if (!action || !execution || confirmedHostedIdentity !== hostedExecutionIdentity(execution)) {
      return;
    }
    const result = await submit({
      actionId: action.actionId,
      body: { executionMode: "hosted", runId, ...execution, confirmPaidOperation: true },
      errorToastTitle: "Hosted visual generation blocked",
      fallbackError: "Studio could not execute the approved hosted visual batch.",
      routePath: action.routePath,
      submittingMessage: "Generating the exact approved hosted visual batch...",
      successMessage: "Hosted scene images were settled and opened for visual review.",
      successToastTitle: "Hosted visuals generated",
    });
    if (result.kind === "success") setSelected(new Set());
  }

  function selectBy(filter: "all" | "pending" | "rejected"): void {
    setSelected(
      new Set(
        summary.scenes
          .filter((scene) => filter === "all" || scene.decision === filter)
          .map((scene) => scene.sceneIndex),
      ),
    );
  }

  return {
    busy,
    clearSelection: () => setSelected(new Set()),
    confirmedHosted: confirmedHostedIdentity === hostedExecutionIdentity(summary.hosted.execution),
    decide,
    fileError,
    generateHosted,
    hostedSelectionBlocked,
    importVisual,
    notes,
    planHosted,
    prepare,
    regenerateRejected,
    reviewedBy,
    selected,
    selectedRejectedCount,
    selectBy,
    setConfirmedHosted: (confirmed: boolean) =>
      setConfirmedHostedIdentity(
        confirmed ? hostedExecutionIdentity(summary.hosted.execution) : null,
      ),
    setNotes,
    setReviewedBy,
    setSceneSelected: (sceneIndex: number, isSelected: boolean) =>
      setSelected((current) => {
        const next = new Set(current);
        if (isSelected) next.add(sceneIndex);
        else next.delete(sceneIndex);
        return next;
      }),
    state,
  };
}

function hostedExecutionIdentity(
  execution: StudioVisualSummary["hosted"]["execution"],
): string | null {
  return execution
    ? JSON.stringify([execution.approvalId, execution.bindingDigest, execution.quoteDigest])
    : null;
}
