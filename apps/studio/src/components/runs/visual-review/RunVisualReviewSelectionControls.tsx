"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { StudioLocale } from "@/i18n/locales";
import type { StudioVisualSummary } from "@/lib/runs/visualSummaries";
import {
  localVisualGenerationBlocker,
  localVisualGenerationCopy,
} from "./localVisualGenerationCopy";
import { visualReviewCopy } from "./visualReviewCopy";

type RunVisualReviewSelectionControlsProps = Readonly<{
  busy: boolean;
  localGenerationAvailable: boolean;
  localVisual: StudioVisualSummary["local"];
  locale: StudioLocale;
  notes: string;
  onClear: () => void;
  onDecide: (status: "approved" | "rejected") => Promise<void>;
  onGenerateLocal: () => Promise<void>;
  onNotesChange: (notes: string) => void;
  onRegenerateRejected: () => Promise<void>;
  onReviewedByChange: (reviewedBy: string) => void;
  onSelectBy: (filter: "all" | "pending" | "rejected") => void;
  regenerateAvailable: boolean;
  reviewedBy: string;
  selectedCount: number;
  selectedRejectedCount: number;
}>;

/**
 * Renders localized selection and review controls for the visual contact sheet.
 *
 * Decision actions require selected items, a nonblank reviewer name, and nonblank notes.
 * Regeneration and local generation actions are disabled when unavailable, when their
 * required selection is empty, or while an operation is busy.
 */
export function RunVisualReviewSelectionControls({
  busy,
  localGenerationAvailable,
  localVisual,
  locale,
  notes,
  onClear,
  onDecide,
  onGenerateLocal,
  onNotesChange,
  onRegenerateRejected,
  onReviewedByChange,
  onSelectBy,
  regenerateAvailable,
  reviewedBy,
  selectedCount,
  selectedRejectedCount,
}: RunVisualReviewSelectionControlsProps) {
  const localCopy = localVisualGenerationCopy(locale);
  const copy = visualReviewCopy(locale);
  const decisionDisabled = busy || selectedCount === 0 || !reviewedBy.trim() || !notes.trim();
  return (
    <div className='bg-muted/10 grid gap-3 rounded-lg p-4'>
      <div className='flex flex-wrap gap-2'>
        <Button size='sm' variant='outline' onClick={() => onSelectBy("all")}>
          {copy.selectAll}
        </Button>
        <Button size='sm' variant='outline' onClick={() => onSelectBy("pending")}>
          {copy.selectPending}
        </Button>
        <Button size='sm' variant='outline' onClick={() => onSelectBy("rejected")}>
          {copy.selectRejected}
        </Button>
        <Button size='sm' variant='ghost' onClick={onClear}>
          {copy.clear}
        </Button>
      </div>
      <div className='grid gap-3 sm:grid-cols-2'>
        <Input
          aria-label={copy.reviewerLabel}
          maxLength={200}
          placeholder={copy.reviewerPlaceholder}
          value={reviewedBy}
          onChange={(event) => onReviewedByChange(event.target.value)}
        />
        <Textarea
          aria-label={copy.notesLabel}
          maxLength={4_000}
          placeholder={copy.notesPlaceholder}
          value={notes}
          onChange={(event) => onNotesChange(event.target.value)}
        />
      </div>
      <div className='flex flex-wrap gap-2'>
        <Button disabled={decisionDisabled} onClick={() => onDecide("approved")}>
          {copy.approveSelected(selectedCount)}
        </Button>
        <Button
          disabled={decisionDisabled}
          variant='destructive'
          onClick={() => onDecide("rejected")}
        >
          {copy.rejectSelected}
        </Button>
        <Button
          disabled={busy || selectedRejectedCount === 0 || !regenerateAvailable}
          variant='secondary'
          onClick={onRegenerateRejected}
        >
          {copy.regenerateRejected(selectedRejectedCount)}
        </Button>
        <Button
          disabled={busy || selectedCount === 0 || !localGenerationAvailable}
          variant='secondary'
          onClick={onGenerateLocal}
        >
          {localCopy.action(selectedCount)}
        </Button>
      </div>
      <p aria-live='polite' className='text-muted-foreground text-xs'>
        {localGenerationAvailable
          ? localCopy.readyHint
          : localVisualGenerationBlocker(locale, localVisual)}
      </p>
    </div>
  );
}
