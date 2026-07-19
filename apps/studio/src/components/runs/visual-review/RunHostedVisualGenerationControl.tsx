"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { StudioLocale } from "@/i18n/locales";
import type { StudioHostedVisualSummary } from "@/lib/runs/visualSummaries";
import { ImageIcon } from "lucide-react";
import { visualReviewCopy } from "./visualReviewCopy";

type Props = Readonly<{
  attributionReady: boolean;
  busy: boolean;
  confirmed: boolean;
  generateAvailable: boolean;
  hosted: StudioHostedVisualSummary;
  locale: StudioLocale;
  mixedSelection: boolean;
  onConfirmedChange: (confirmed: boolean) => void;
  onGenerate: () => void;
  onPlan: () => void;
  planAvailable: boolean;
  regenerateSelected: boolean;
  selectedCount: number;
}>;

/**
 * Provides the Studio-first hosted visual planning, approval, and generation workflow.
 *
 * Displays configuration or evidence blocking states, prevents invalid beat selections from being
 * planned, and requires confirmation of the exact approved plan, quote, and execution identity
 * before generation. Rejected-beat regeneration also requires reviewer attribution and revision
 * notes.
 *
 * @param props - Control state, hosted operation data, and workflow callbacks.
 * @returns The hosted visual generation controls, a blocking alert, or `null` when the hosted mode
 * is unsupported.
 */
export function RunHostedVisualGenerationControl({
  attributionReady,
  busy,
  confirmed,
  generateAvailable,
  hosted,
  locale,
  mixedSelection,
  onConfirmedChange,
  onGenerate,
  onPlan,
  planAvailable,
  regenerateSelected,
  selectedCount,
}: Props) {
  const copy = visualReviewCopy(locale);
  if (hosted.mode === "unknown" && hosted.blockedReason) {
    return (
      <Alert variant='destructive'>
        <AlertTitle>{copy.hostedBlocked}</AlertTitle>
        <AlertDescription>
          <p>{copy.hostedEvidenceBlocked}</p>
          <details className='mt-2 text-xs'>
            <summary className='cursor-pointer font-medium'>{copy.advancedEvidence}</summary>
            <p className='mt-1 break-all'>{hosted.blockedReason}</p>
          </details>
        </AlertDescription>
      </Alert>
    );
  }
  if (hosted.mode !== "hosted" || !hosted.provider) return null;
  const executionReady = Boolean(hosted.execution);
  const credentialReady = hosted.provider.credentialStatus === "configured";
  return (
    <section className='border-primary/25 bg-primary/5 grid gap-3 rounded-lg border p-4'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h3 className='font-semibold'>{copy.hostedTitle}</h3>
          <p className='text-muted-foreground mt-1 max-w-3xl text-sm'>{copy.hostedDescription}</p>
        </div>
        <div className='flex flex-wrap gap-2'>
          <Badge variant='outline'>
            {copy.plan}: {formatStatus(locale, hosted.plan.status)}
          </Badge>
          <Badge variant='outline'>
            {copy.quote}: {formatStatus(locale, hosted.quote.status)}
          </Badge>
          <Badge variant='outline'>
            {copy.approval}: {formatStatus(locale, hosted.approval.status)}
          </Badge>
          <Badge variant='outline'>{hosted.provider.modelLabel}</Badge>
          <Badge variant='outline'>{hosted.provider.readiness}</Badge>
          <Badge variant={credentialReady ? "secondary" : "destructive"}>
            {credentialReady ? copy.credentialConfigured : copy.credentialMissing}
          </Badge>
        </div>
      </div>

      <dl className='grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-4'>
        <div>
          {copy.provider}: {hosted.provider.label}
        </div>
        <div>
          {copy.model}: {hosted.provider.modelId}
        </div>
        <div>
          {copy.scenes}: {hosted.plan.sceneIndexes.length || selectedCount}
        </div>
        <div>
          {copy.purpose}: {formatPurpose(locale, hosted.plan.purpose, copy.newPlan)}
        </div>
      </dl>

      {credentialReady ? (
        <p className='text-muted-foreground text-sm'>{copy.credentialPresentHint}</p>
      ) : (
        <p className='text-muted-foreground text-sm'>{copy.credentialRequiredHint}</p>
      )}

      {hosted.quote.estimatedUsd !== undefined ? (
        <p className='text-sm'>
          {copy.quotedCap}: ${hosted.quote.estimatedUsd.toFixed(2)}
        </p>
      ) : null}

      {hosted.blockedReason ? (
        <Alert variant='destructive'>
          <AlertTitle>{copy.hostedEvidenceBlocked}</AlertTitle>
          <AlertDescription>
            <details className='text-xs'>
              <summary className='cursor-pointer font-medium'>{copy.advancedEvidence}</summary>
              <p className='mt-1 break-all'>{hosted.blockedReason}</p>
            </details>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className='flex flex-wrap gap-2'>
        <Button
          disabled={
            busy ||
            !planAvailable ||
            selectedCount === 0 ||
            mixedSelection ||
            (regenerateSelected && !attributionReady)
          }
          onClick={onPlan}
        >
          {regenerateSelected ? copy.regenerateRejected(selectedCount) : copy.planSelected}
          {!regenerateSelected ? `(${selectedCount})` : null}
        </Button>
      </div>
      {mixedSelection ? (
        <p className='text-muted-foreground text-sm'>{copy.hostedMixedSelection}</p>
      ) : null}
      {regenerateSelected && !attributionReady ? (
        <p className='text-muted-foreground text-sm'>{copy.hostedNeedsAttribution}</p>
      ) : null}

      {hosted.execution ? (
        <div className='bg-background grid gap-3 rounded-md border p-3'>
          <details className='text-xs'>
            <summary className='cursor-pointer font-medium'>{copy.hostedIdentity}</summary>
            <dl className='mt-2 grid gap-1 break-all'>
              <div>
                {copy.approval}: {hosted.execution.approvalId}
              </div>
              <div>
                {copy.planBinding}: {hosted.execution.bindingDigest}
              </div>
              <div>
                {copy.quote}: {hosted.execution.quoteDigest}
              </div>
            </dl>
          </details>
          <div className='flex items-start gap-2'>
            <Checkbox
              checked={confirmed}
              disabled={busy}
              id='confirm-paid-hosted-visual-operation'
              onCheckedChange={(checked) => onConfirmedChange(checked === true)}
            />
            <Label className='leading-snug' htmlFor='confirm-paid-hosted-visual-operation'>
              {copy.confirmHosted(
                hosted.provider.modelLabel,
                hosted.plan.sceneIndexes.length,
                hosted.quote.estimatedUsd?.toFixed(2) ?? "0.00",
              )}
            </Label>
          </div>
          <Button
            disabled={busy || !generateAvailable || !executionReady || !confirmed}
            onClick={onGenerate}
          >
            <ImageIcon />
            {copy.generateApproved}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function formatStatus(locale: StudioLocale, status: string): string {
  if (locale !== "tr") return status;
  const labels: Readonly<Record<string, string>> = {
    approved: "onaylandı",
    blocked: "engellendi",
    missing: "eksik",
    ready: "hazır",
    settled: "uzlaştırıldı",
  };
  return labels[status] ?? status;
}

function formatPurpose(
  locale: StudioLocale,
  purpose: string | null | undefined,
  fallback: string,
): string {
  if (!purpose) return fallback;
  if (locale === "tr" && purpose === "regenerate-rejected") return "reddedilenleri yeniden üret";
  if (locale === "tr" && purpose === "new-production") return "yeni üretim";
  return purpose;
}
