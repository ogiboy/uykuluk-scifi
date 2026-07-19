"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { StudioLocale } from "@/i18n/locales";
import type { StudioGuardedActionSubmitState } from "@/lib/mutations/useStudioGuardedActionSubmit";
import type { StudioVisualSummary } from "@/lib/runs/visualSummaries";
import { RunDetailCard } from "../RunDetailCard";
import { RunHostedVisualGenerationControl } from "./RunHostedVisualGenerationControl";
import { RunVisualManifestEvidence } from "./RunVisualManifestEvidence";
import { RunVisualReviewSelectionControls } from "./RunVisualReviewSelectionControls";
import { RunVisualSceneCard } from "./RunVisualSceneCard";
import { useRunVisualReviewActions } from "./useRunVisualReviewActions";
import type { VisualReviewCopy } from "./visualReviewCopy";
import { visualReviewCopy } from "./visualReviewCopy";

type RunVisualReviewPanelProps = Readonly<{
  locale: StudioLocale;
  runId: string;
  summary: StudioVisualSummary;
}>;

/** Renders visual preparation, contact-sheet decisions, and per-beat manual revision controls. */
export function RunVisualReviewPanel({ locale, runId, summary }: RunVisualReviewPanelProps) {
  const copy = visualReviewCopy(locale);
  const actions = useRunVisualReviewActions(runId, summary, locale);
  return (
    <RunDetailCard
      headingId='visual-review-heading'
      title={copy.panelTitle}
      description={copy.panelDescription}
    >
      <div className='flex flex-wrap items-center gap-2'>
        <Badge variant={summary.kind === "invalid" ? "destructive" : "secondary"}>
          {copy.summaryStatus[summary.kind]}
        </Badge>
        <span className='text-muted-foreground'>{visualSummaryMessage(copy, summary)}</span>
      </div>

      {summary.kind === "missing" ? (
        <Button
          disabled={actions.busy || !summary.actions["visuals.prepare"]}
          onClick={() => void actions.prepare()}
        >
          {copy.prepareAction}
        </Button>
      ) : null}
      {summary.kind === "invalid" ? (
        <Alert variant='destructive'>
          <AlertTitle>{copy.invalidEvidence}</AlertTitle>
          <AlertDescription>{copy.summaryInvalid}</AlertDescription>
        </Alert>
      ) : null}

      {summary.kind === "ready" ? (
        <>
          <RunHostedVisualGenerationControl
            attributionReady={Boolean(actions.reviewedBy.trim() && actions.notes.trim())}
            busy={actions.busy}
            confirmed={actions.confirmedHosted}
            generateAvailable={Boolean(summary.actions["visuals.generate-hosted"])}
            hosted={summary.hosted}
            locale={locale}
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
            localGenerationAvailable={Boolean(summary.actions["visuals.generate-local"])}
            localVisual={summary.local}
            locale={locale}
            notes={actions.notes}
            regenerateAvailable={Boolean(summary.actions["visuals.regenerate"])}
            reviewedBy={actions.reviewedBy}
            selectedCount={actions.selected.size}
            selectedRejectedCount={actions.selectedRejectedCount}
            onClear={actions.clearSelection}
            onDecide={actions.decide}
            onGenerateLocal={actions.generateLocal}
            onNotesChange={actions.setNotes}
            onRegenerateRejected={actions.regenerateRejected}
            onReviewedByChange={actions.setReviewedBy}
            onSelectBy={actions.selectBy}
          />

          {actions.fileError ? (
            <Alert variant='destructive'>
              <AlertTitle>{copy.imageNotAccepted}</AlertTitle>
              <AlertDescription>{actions.fileError}</AlertDescription>
            </Alert>
          ) : null}

          <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
            {summary.scenes.map((scene) => (
              <RunVisualSceneCard
                busy={actions.busy}
                importAvailable={Boolean(summary.actions["visuals.import"])}
                key={scene.sceneIndex}
                locale={locale}
                revisionActivationAvailable={Boolean(summary.actions["visuals.activate-revision"])}
                scene={scene}
                selected={actions.selected.has(scene.sceneIndex)}
                onActivateRevision={actions.activateRevision}
                onImport={actions.importVisual}
                onSelect={actions.setSceneSelected}
              />
            ))}
          </div>
        </>
      ) : null}

      <VisualActionStatus locale={locale} state={actions.state} />
      <RunVisualManifestEvidence locale={locale} summary={summary} />
      {summary.kind === "invalid" ? (
        <details className='text-muted-foreground text-xs'>
          <summary className='cursor-pointer font-medium'>{copy.advancedEvidence}</summary>
          <p className='mt-2 break-all'>{summary.message}</p>
        </details>
      ) : null}
    </RunDetailCard>
  );
}

function visualSummaryMessage(copy: VisualReviewCopy, summary: StudioVisualSummary): string {
  if (summary.kind === "ready") {
    return copy.summary(summary.approvedCount, summary.scenes.length, summary.rejectedCount);
  }
  if (summary.kind === "missing") return copy.summaryMissing;
  return copy.summaryInvalid;
}

function VisualActionStatus({
  locale,
  state,
}: Readonly<{ locale: StudioLocale; state: StudioGuardedActionSubmitState }>) {
  if (state.kind === "idle") return null;
  const isProblem = state.kind === "blocked" || state.kind === "error";
  const status = visualActionStatus(locale, state.kind);
  return (
    <Alert
      aria-live={isProblem ? "assertive" : "polite"}
      variant={isProblem ? "destructive" : "default"}
    >
      <AlertTitle className='flex items-center justify-between gap-3'>
        {locale === "tr" ? "Son görsel eylemi" : "Latest visual action"}
        <Badge variant={isProblem ? "destructive" : "secondary"}>{status}</Badge>
      </AlertTitle>
      <AlertDescription>{state.message}</AlertDescription>
    </Alert>
  );
}

function visualActionStatus(
  locale: StudioLocale,
  kind: StudioGuardedActionSubmitState["kind"],
): string {
  if (locale !== "tr") return kind;
  const statuses: Readonly<Record<StudioGuardedActionSubmitState["kind"], string>> = {
    blocked: "engellendi",
    error: "hata",
    idle: "bekliyor",
    submitting: "gönderiliyor",
    success: "başarılı",
  };
  return statuses[kind];
}
