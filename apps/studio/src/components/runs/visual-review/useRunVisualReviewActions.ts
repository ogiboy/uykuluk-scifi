"use client";

import type { StudioLocale } from "@/i18n/locales";
import { useStudioGuardedActionSubmit } from "@/lib/mutations/useStudioGuardedActionSubmit";
import type { StudioVisualSummary } from "@/lib/runs/visualSummaries";
import { useState } from "react";
import { localVisualGenerationCopy } from "./localVisualGenerationCopy";
import { visualFileProblem } from "./visualFileValidation";
import { encodeVisualImportFile } from "./visualImportFile";
import { visualReviewCopy } from "./visualReviewCopy";

/**
 * Coordinates guarded visual-review actions and selection state for a run.
 * Actions use persisted revision and manifest evidence to protect review, import,
 * regeneration, and hosted execution workflows.
 *
 * @param runId - Identifier of the run whose visuals are being reviewed.
 * @param summary - Current visual-review state and available workflow actions.
 * @param locale - Locale used for action feedback and UI messages.
 * @returns Selection state, review fields, derived status, setters, and guarded action handlers.
 */
export function useRunVisualReviewActions(
  runId: string,
  summary: StudioVisualSummary,
  locale: StudioLocale,
) {
  const localCopy = localVisualGenerationCopy(locale);
  const copy = visualReviewCopy(locale);
  const { reportError, state, submit } = useStudioGuardedActionSubmit(
    locale === "tr"
      ? "Görsel eylemler açıktır ve tamamlandığında kalıcı bölüm kanıtını yeniler."
      : "Visual actions are explicit and refresh persisted run evidence after completion.",
  );
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [reviewedBy, setReviewedBy] = useState("");
  const [notes, setNotes] = useState("");
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
      errorToastTitle: copy.prepareBlocked,
      fallbackError: copy.prepareFallback,
      routePath: action.routePath,
      submittingMessage: copy.prepareSubmitting,
      successMessage: copy.prepareSuccess,
      successToastTitle: copy.prepareTitle,
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
      errorToastTitle: copy.decisionBlocked,
      fallbackError: copy.decisionFallback,
      routePath: action.routePath,
      submittingMessage: copy.decisionSubmitting(copy.status[status], selected.size),
      successMessage: copy.decisionSuccess(copy.status[status], selected.size),
      successToastTitle: copy.decisionTitle,
    });
    if (result.kind === "success") setSelected(new Set());
  }

  async function activateRevision(sceneIndex: number, revision: number): Promise<void> {
    const action = summary.actions["visuals.activate-revision"];
    if (!action || !summary.manifestDigest) return;
    await submit({
      actionId: action.actionId,
      body: {
        expectedActiveRevisions: summary.activeRevisions,
        expectedManifestDigest: summary.manifestDigest,
        revision,
        runId,
        sceneIndex,
      },
      errorToastTitle: copy.activateBlocked,
      fallbackError: copy.activateFallback,
      routePath: action.routePath,
      submittingMessage: copy.activateSubmitting(revision, sceneIndex),
      successMessage: copy.activateSuccess(revision, sceneIndex),
      successToastTitle: copy.activateTitle,
    });
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
      errorToastTitle: copy.importBlocked,
      fallbackError: copy.importFallback,
      routePath: action.routePath,
      submittingMessage: copy.importSubmitting(sceneIndex),
      successMessage: copy.importSuccess(sceneIndex),
      successToastTitle: copy.importTitle,
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
      errorToastTitle: copy.regenerationBlocked,
      fallbackError: copy.regenerationFallback,
      routePath: action.routePath,
      submittingMessage: copy.regenerationSubmitting(sceneIndexes.length),
      successMessage: copy.regenerationSuccess(sceneIndexes.length),
      successToastTitle: copy.regenerationTitle,
    });
    if (result.kind === "success") setSelected(new Set());
  }

  async function generateLocal(): Promise<void> {
    const action = summary.actions["visuals.generate-local"];
    if (!action || !summary.manifestDigest || selected.size === 0) return;
    const result = await submit({
      actionId: action.actionId,
      body: {
        expectedActiveRevisions: summary.activeRevisions,
        expectedManifestDigest: summary.manifestDigest,
        runId,
        sceneIndexes: [...selected],
      },
      errorToastTitle: localCopy.blocked,
      fallbackError: localCopy.fallbackError,
      routePath: action.routePath,
      submittingMessage: localCopy.submitting(selected.size),
      successMessage: localCopy.success,
      successToastTitle: localCopy.successTitle,
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
        message: copy.hostedMixedSelection,
        routePath: action.routePath,
        toastTitle: copy.hostedSelectionBlocked,
      });
      return;
    }
    if (purpose === "regenerate-rejected" && (!reviewedBy.trim() || !notes.trim())) {
      reportError({
        actionId: action.actionId,
        message: copy.hostedNeedsAttribution,
        routePath: action.routePath,
        toastTitle: copy.hostedSelectionBlocked,
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
      errorToastTitle: copy.hostedPlanBlocked,
      fallbackError: copy.hostedPlanFallback,
      routePath: action.routePath,
      submittingMessage: copy.hostedPlanSubmitting(
        selected.size,
        purpose === "regenerate-rejected",
      ),
      successMessage: copy.hostedPlanReady,
      successToastTitle: copy.hostedPlanReady,
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
      errorToastTitle: copy.generateHostedBlocked,
      fallbackError: copy.generateHostedFallback,
      routePath: action.routePath,
      submittingMessage: copy.generateHostedSubmitting,
      successMessage: copy.generateHostedSuccess,
      successToastTitle: copy.generateHostedTitle,
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
    activateRevision,
    busy,
    clearSelection: () => setSelected(new Set()),
    confirmedHosted: confirmedHostedIdentity === hostedExecutionIdentity(summary.hosted.execution),
    decide,
    fileError,
    generateLocal,
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

/**
 * Creates a stable identity for a hosted execution confirmation.
 *
 * @param execution - The hosted execution to identify, or `null` when no execution is available
 * @returns A serialized identity based on the execution approval, binding, and quote digests, or `null`
 */
function hostedExecutionIdentity(
  execution: StudioVisualSummary["hosted"]["execution"],
): string | null {
  return execution
    ? JSON.stringify([execution.approvalId, execution.bindingDigest, execution.quoteDigest])
    : null;
}
