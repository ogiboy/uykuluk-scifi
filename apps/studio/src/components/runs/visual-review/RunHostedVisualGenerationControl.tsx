"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { StudioHostedVisualSummary } from "@/lib/runs/visualSummaries";
import { ImageIcon } from "lucide-react";

type Props = Readonly<{
  attributionReady: boolean;
  busy: boolean;
  confirmed: boolean;
  generateAvailable: boolean;
  hosted: StudioHostedVisualSummary;
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
  mixedSelection,
  onConfirmedChange,
  onGenerate,
  onPlan,
  planAvailable,
  regenerateSelected,
  selectedCount,
}: Props) {
  if (hosted.mode === "unknown" && hosted.blockedReason) {
    return (
      <Alert variant='destructive'>
        <AlertTitle>Hosted visual configuration is blocked</AlertTitle>
        <AlertDescription>{hosted.blockedReason}</AlertDescription>
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
          <h3 className='font-semibold'>Hosted scene generation</h3>
          <p className='text-muted-foreground mt-1 max-w-3xl text-sm'>
            Select visual beats, persist one exact provider plan, then use the normal cost approval
            step. Rejected hosted beats reopen as an attributed revision.
          </p>
        </div>
        <div className='flex flex-wrap gap-2'>
          <Badge variant='outline'>Plan: {hosted.plan.status}</Badge>
          <Badge variant='outline'>Quote: {hosted.quote.status}</Badge>
          <Badge variant='outline'>Approval: {hosted.approval.status}</Badge>
          <Badge variant='outline'>{hosted.provider.modelLabel}</Badge>
          <Badge variant='outline'>{hosted.provider.readiness}</Badge>
          <Badge variant={credentialReady ? "secondary" : "destructive"}>
            {credentialReady ? "credential configured" : "credential missing"}
          </Badge>
        </div>
      </div>

      <dl className='grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-4'>
        <div>Provider: {hosted.provider.label}</div>
        <div>Model: {hosted.provider.modelId}</div>
        <div>Scenes: {hosted.plan.sceneIndexes.length || selectedCount}</div>
        <div>Purpose: {hosted.plan.purpose ?? "new plan"}</div>
      </dl>

      {credentialReady ? (
        <p className='text-muted-foreground text-sm'>
          Credential presence only. Balance, entitlement, usage rights, and provider availability
          are not confirmed until the provider responds.
        </p>
      ) : (
        <p className='text-muted-foreground text-sm'>
          A new hosted request needs a server-side credential. Recovery from an already committed
          result remains available without sending the provider request again.
        </p>
      )}

      {hosted.quote.estimatedUsd !== undefined ? (
        <p className='text-sm'>Quoted batch cap: ${hosted.quote.estimatedUsd.toFixed(2)}</p>
      ) : null}

      {hosted.blockedReason ? (
        <Alert variant='destructive'>
          <AlertTitle>Hosted visual evidence is blocked</AlertTitle>
          <AlertDescription>{hosted.blockedReason}</AlertDescription>
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
          {regenerateSelected ? "Regenerate rejected" : "Plan selected"} ({selectedCount})
        </Button>
      </div>
      {mixedSelection ? (
        <p className='text-muted-foreground text-sm'>
          This workflow state accepts only rejected beats backed by exact settled hosted evidence.
          Clear pending, approved, static, or manual beats from the selection.
        </p>
      ) : null}
      {regenerateSelected && !attributionReady ? (
        <p className='text-muted-foreground text-sm'>
          Add both reviewer attribution and revision notes before planning rejected hosted beats.
        </p>
      ) : null}

      {hosted.execution ? (
        <div className='bg-background grid gap-3 rounded-md border p-3'>
          <details className='text-xs'>
            <summary className='cursor-pointer font-medium'>Exact paid-operation identity</summary>
            <dl className='mt-2 grid gap-1 break-all'>
              <div>Approval: {hosted.execution.approvalId}</div>
              <div>Plan binding: {hosted.execution.bindingDigest}</div>
              <div>Quote: {hosted.execution.quoteDigest}</div>
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
              I confirm {hosted.provider.modelLabel} for {hosted.plan.sceneIndexes.length} scene(s)
              with a maximum quoted batch cost of ${hosted.quote.estimatedUsd?.toFixed(2) ?? "0.00"}
              .
            </Label>
          </div>
          <Button
            disabled={busy || !generateAvailable || !executionReady || !confirmed}
            onClick={onGenerate}
          >
            <ImageIcon />
            Generate approved scene images
          </Button>
        </div>
      ) : null}
    </section>
  );
}
