"use client";

import { StudioMutationResultPanel } from "@/components/studio/StudioMutationResultPanel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { StudioVisualSummary } from "@/lib/runs/visualSummaries";
import { RunDetailCard } from "../RunDetailCard";
import { RunHostedVisualGenerationControl } from "./RunHostedVisualGenerationControl";
import { RunVisualManifestEvidence } from "./RunVisualManifestEvidence";
import { RunVisualReviewSelectionControls } from "./RunVisualReviewSelectionControls";
import { RunVisualSceneCard } from "./RunVisualSceneCard";
import { useRunVisualReviewActions } from "./useRunVisualReviewActions";

type RunVisualReviewPanelProps = Readonly<{ runId: string; summary: StudioVisualSummary }>;

/** Renders visual preparation, contact-sheet decisions, and per-beat manual revision controls. */
export function RunVisualReviewPanel({ runId, summary }: RunVisualReviewPanelProps) {
  const actions = useRunVisualReviewActions(runId, summary);
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
        <Button
          disabled={actions.busy || !summary.actions["visuals.prepare"]}
          onClick={() => void actions.prepare()}
        >
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
          <RunHostedVisualGenerationControl
            busy={actions.busy}
            confirmed={actions.confirmedHosted}
            generateAvailable={Boolean(summary.actions["visuals.generate-hosted"])}
            hosted={summary.hosted}
            mixedSelection={actions.hostedSelectionBlocked}
            planAvailable={Boolean(summary.actions["visuals.plan-hosted"])}
            regenerateSelected={summary.hosted.allowedPlanPurpose === "regenerate-rejected"}
            selectedCount={actions.selected.size}
            onConfirmedChange={actions.setConfirmedHosted}
            onGenerate={() => void actions.generateHosted()}
            onPlan={() => void actions.planHosted()}
          />
          <RunVisualReviewSelectionControls
            busy={actions.busy}
            notes={actions.notes}
            regenerateAvailable={Boolean(summary.actions["visuals.regenerate"])}
            reviewedBy={actions.reviewedBy}
            selectedCount={actions.selected.size}
            selectedRejectedCount={actions.selectedRejectedCount}
            onClear={actions.clearSelection}
            onDecide={actions.decide}
            onNotesChange={actions.setNotes}
            onRegenerateRejected={actions.regenerateRejected}
            onReviewedByChange={actions.setReviewedBy}
            onSelectBy={actions.selectBy}
          />

          {actions.fileError ? (
            <Alert variant='destructive'>
              <AlertTitle>Image not accepted</AlertTitle>
              <AlertDescription>{actions.fileError}</AlertDescription>
            </Alert>
          ) : null}

          <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
            {summary.scenes.map((scene) => (
              <RunVisualSceneCard
                busy={actions.busy}
                importAvailable={Boolean(summary.actions["visuals.import"])}
                key={scene.sceneIndex}
                scene={scene}
                selected={actions.selected.has(scene.sceneIndex)}
                onImport={actions.importVisual}
                onSelect={actions.setSceneSelected}
              />
            ))}
          </div>
        </>
      ) : null}

      <StudioMutationResultPanel state={actions.state} />
      <RunVisualManifestEvidence summary={summary} />
    </RunDetailCard>
  );
}
