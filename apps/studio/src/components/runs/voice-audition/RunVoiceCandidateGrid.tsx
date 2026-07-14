"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { StudioVoiceCandidateSummary } from "@/lib/runs/voiceAuditionSummaries";
import { LocalPreviewPlayer, VoiceComparison } from "./RunVoicePreviewPlayers";

type RunVoiceCandidateGridProps = Readonly<{
  busy: boolean;
  candidates: readonly StudioVoiceCandidateSummary[];
  compareVoiceIds: readonly string[];
  previewActionAvailable: boolean;
  runId: string;
  selectActionAvailable: boolean;
  onChoose: (voiceId: string) => void;
  onCompare: (voiceId: string) => void;
  onPreview: (voiceId: string) => void;
}>;

/** Renders bounded voice cards plus a two-slot local-only A/B player. */
export function RunVoiceCandidateGrid({
  busy,
  candidates,
  compareVoiceIds,
  previewActionAvailable,
  runId,
  selectActionAvailable,
  onChoose,
  onCompare,
  onPreview,
}: RunVoiceCandidateGridProps) {
  const boundedCandidates = candidates.slice(0, 24);
  const comparison = compareVoiceIds
    .map((voiceId) => boundedCandidates.find((candidate) => candidate.voiceId === voiceId))
    .filter((candidate): candidate is StudioVoiceCandidateSummary => Boolean(candidate));
  return (
    <div className='grid gap-4'>
      <VoiceComparison candidates={comparison} runId={runId} />
      {boundedCandidates.length > 0 ? (
        <div className='grid gap-3 lg:grid-cols-2'>
          {boundedCandidates.map((candidate) => (
            <VoiceCandidate
              busy={busy}
              candidate={candidate}
              comparing={compareVoiceIds.includes(candidate.voiceId)}
              key={candidate.voiceId}
              previewActionAvailable={previewActionAvailable}
              runId={runId}
              selectActionAvailable={selectActionAvailable}
              onChoose={onChoose}
              onCompare={onCompare}
              onPreview={onPreview}
            />
          ))}
        </div>
      ) : (
        <p className='bg-muted/10 text-muted-foreground rounded-lg p-4 text-sm'>
          Candidate cards appear only after an explicit operator catalog request persists local
          evidence.
        </p>
      )}
    </div>
  );
}

function VoiceCandidate({
  busy,
  candidate,
  comparing,
  previewActionAvailable,
  runId,
  selectActionAvailable,
  onChoose,
  onCompare,
  onPreview,
}: Readonly<{
  busy: boolean;
  candidate: StudioVoiceCandidateSummary;
  comparing: boolean;
  previewActionAvailable: boolean;
  runId: string;
  selectActionAvailable: boolean;
  onChoose: (voiceId: string) => void;
  onCompare: (voiceId: string) => void;
  onPreview: (voiceId: string) => void;
}>) {
  const selectable =
    selectActionAvailable &&
    candidate.preview.kind === "ready" &&
    candidate.metadataFreshness === "fresh" &&
    candidate.eligibility.status !== "blocked";
  return (
    <article className='bg-muted/10 ring-border/5 grid min-w-0 gap-3 rounded-lg p-4 ring-1'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div className='min-w-0'>
          <h3 className='font-semibold'>{candidate.name}</h3>
          <p className='text-muted-foreground text-xs break-all'>{candidate.voiceId}</p>
        </div>
        <div className='flex flex-wrap gap-1.5'>
          {candidate.isSelected ? <Badge variant='secondary'>Current selection</Badge> : null}
          <Badge variant={eligibilityVariant(candidate.eligibility.status)}>
            {candidate.eligibility.status}
          </Badge>
        </div>
      </div>

      {candidate.description ? (
        <p className='text-muted-foreground line-clamp-3 text-sm'>{candidate.description}</p>
      ) : null}

      <dl className='grid gap-2 text-sm sm:grid-cols-2'>
        <VoiceFact label='Turkish suitability' value={candidate.turkishSuitability} />
        <VoiceFact label='Category' value={candidate.category} />
        <VoiceFact
          label='Tier availability'
          value={candidate.tiers.length > 0 ? candidate.tiers.join(", ") : "not declared"}
        />
        <VoiceFact label='Metadata freshness' value={candidate.metadataFreshness} />
        <VoiceFact label='Production rights' value={candidate.productionRightsLabel} wide />
      </dl>

      {candidate.eligibility.reasons.length > 0 ? (
        <ul className='grid gap-1 text-xs text-amber-800 dark:text-amber-200'>
          {candidate.eligibility.reasons.map((reason) => (
            <li key={reason}>• {reason}</li>
          ))}
        </ul>
      ) : null}

      <LocalPreviewPlayer preview={candidate.preview} runId={runId} />

      <div className='flex flex-wrap gap-2'>
        <Button
          disabled={busy || !previewActionAvailable}
          size='sm'
          type='button'
          variant='secondary'
          onClick={() => onPreview(candidate.voiceId)}
        >
          {candidate.preview.kind === "ready" ? "Refresh preview" : "Record preview"}
        </Button>
        <Button
          disabled={candidate.preview.kind !== "ready"}
          size='sm'
          type='button'
          variant={comparing ? "default" : "outline"}
          onClick={() => onCompare(candidate.voiceId)}
        >
          {comparing ? "Remove from A/B" : "Add to A/B"}
        </Button>
        <Button
          disabled={busy || !selectable || candidate.isSelected}
          size='sm'
          type='button'
          onClick={() => onChoose(candidate.voiceId)}
        >
          {candidate.isSelected ? "Selected" : "Choose voice"}
        </Button>
      </div>
    </article>
  );
}

function VoiceFact({
  label,
  value,
  wide = false,
}: Readonly<{ label: string; value: string; wide?: boolean }>) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className='text-muted-foreground text-xs'>{label}</dt>
      <dd className='mt-0.5 capitalize'>{value}</dd>
    </div>
  );
}

function eligibilityVariant(
  status: StudioVoiceCandidateSummary["eligibility"]["status"],
): "destructive" | "outline" | "secondary" {
  if (status === "blocked") return "destructive";
  if (status === "eligible") return "secondary";
  return "outline";
}
