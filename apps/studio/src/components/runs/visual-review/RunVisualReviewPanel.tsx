"use client";

import { StudioMutationResultPanel } from "@/components/studio/StudioMutationResultPanel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useStudioGuardedActionSubmit } from "@/lib/mutations/useStudioGuardedActionSubmit";
import type { StudioVisualSummary } from "@/lib/runs/visualSummaries";
import { useState } from "react";
import { RunDetailCard } from "../RunDetailCard";
import { RunVisualManifestEvidence } from "./RunVisualManifestEvidence";
import { RunVisualReviewSelectionControls } from "./RunVisualReviewSelectionControls";
import { RunVisualSceneCard } from "./RunVisualSceneCard";
import { visualFileProblem } from "./visualFileValidation";
import { encodeVisualImportFile } from "./visualImportFile";

type RunVisualReviewPanelProps = Readonly<{ runId: string; summary: StudioVisualSummary }>;

/** Renders visual preparation, contact-sheet decisions, and per-beat manual revision controls. */
export function RunVisualReviewPanel({ runId, summary }: RunVisualReviewPanelProps) {
  const { reportError, state, submit } = useStudioGuardedActionSubmit(
    "Visual actions are explicit and refresh persisted run evidence after completion.",
  );
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [reviewedBy, setReviewedBy] = useState("operator");
  const [notes, setNotes] = useState("Reviewed in the Studio visual contact sheet.");
  const [fileError, setFileError] = useState<string | null>(null);
  const busy = state.kind === "submitting";

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
    const rejectedSceneIndexes = summary.scenes
      .filter((scene) => scene.decision === "rejected" && selected.has(scene.sceneIndex))
      .map((scene) => scene.sceneIndex);
    if (rejectedSceneIndexes.length === 0) return;
    const result = await submit({
      actionId: action.actionId,
      body: {
        expectedActiveRevisions: summary.activeRevisions,
        expectedManifestDigest: summary.manifestDigest,
        runId,
        sceneIndexes: rejectedSceneIndexes,
      },
      errorToastTitle: "Visual regeneration blocked",
      fallbackError: "Studio could not regenerate the rejected visual beats.",
      routePath: action.routePath,
      submittingMessage: `Regenerating ${rejectedSceneIndexes.length} rejected visual beats...`,
      successMessage: `Regenerated ${rejectedSceneIndexes.length} rejected visual beats as pending revisions.`,
      successToastTitle: "Rejected visuals regenerated",
    });
    if (result.kind === "success") setSelected(new Set());
  }

  const selectedRejectedCount = summary.scenes.filter(
    (scene) => scene.decision === "rejected" && selected.has(scene.sceneIndex),
  ).length;

  return (
    <RunDetailCard
      headingId='visual-review-heading'
      title='Scene Visual Review'
      description='Review 12-24 episode-specific visual beats, replace only weak scenes, then bind approved revisions into the exact render plan.'
    >
      <div className='flex flex-wrap items-center gap-2'>
        <Badge variant={summary.kind === "invalid" ? "destructive" : "secondary"}>
          {summary.kind}
        </Badge>
        <span className='text-muted-foreground'>{summary.message}</span>
      </div>

      {summary.kind === "missing" ? (
        <Button disabled={busy || !summary.actions["visuals.prepare"]} onClick={prepare}>
          Prepare 12-24 visual beats
        </Button>
      ) : null}
      {summary.kind === "invalid" ? (
        <Alert variant='destructive'>
          <AlertTitle>Visual evidence cannot be trusted</AlertTitle>
          <AlertDescription>{summary.message}</AlertDescription>
        </Alert>
      ) : null}

      {summary.kind === "ready" ? (
        <>
          <RunVisualReviewSelectionControls
            busy={busy}
            notes={notes}
            regenerateAvailable={Boolean(summary.actions["visuals.regenerate"])}
            reviewedBy={reviewedBy}
            selectedCount={selected.size}
            selectedRejectedCount={selectedRejectedCount}
            onClear={() => setSelected(new Set())}
            onDecide={decide}
            onNotesChange={setNotes}
            onRegenerateRejected={regenerateRejected}
            onReviewedByChange={setReviewedBy}
            onSelectBy={selectBy}
          />

          {fileError ? (
            <Alert variant='destructive'>
              <AlertTitle>Image not accepted</AlertTitle>
              <AlertDescription>{fileError}</AlertDescription>
            </Alert>
          ) : null}

          <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
            {summary.scenes.map((scene) => (
              <RunVisualSceneCard
                busy={busy}
                importAvailable={Boolean(summary.actions["visuals.import"])}
                key={scene.sceneIndex}
                scene={scene}
                selected={selected.has(scene.sceneIndex)}
                onImport={importVisual}
                onSelect={(sceneIndex, isSelected) => {
                  const next = new Set(selected);
                  if (isSelected) next.add(sceneIndex);
                  else next.delete(sceneIndex);
                  setSelected(next);
                }}
              />
            ))}
          </div>
        </>
      ) : null}

      <StudioMutationResultPanel state={state} />
      <RunVisualManifestEvidence summary={summary} />
    </RunDetailCard>
  );

  function selectBy(filter: "all" | "pending" | "rejected"): void {
    setSelected(
      new Set(
        summary.scenes
          .filter((scene) => filter === "all" || scene.decision === filter)
          .map((scene) => scene.sceneIndex),
      ),
    );
  }
}
