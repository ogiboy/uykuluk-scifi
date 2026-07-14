"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type RunVisualReviewSelectionControlsProps = Readonly<{
  busy: boolean;
  notes: string;
  onClear: () => void;
  onDecide: (status: "approved" | "rejected") => Promise<void>;
  onNotesChange: (notes: string) => void;
  onRegenerateRejected: () => Promise<void>;
  onReviewedByChange: (reviewedBy: string) => void;
  onSelectBy: (filter: "all" | "pending" | "rejected") => void;
  regenerateAvailable: boolean;
  reviewedBy: string;
  selectedCount: number;
  selectedRejectedCount: number;
}>;

/** Renders selection, reviewer metadata, and decision controls for the visual contact sheet. */
export function RunVisualReviewSelectionControls({
  busy,
  notes,
  onClear,
  onDecide,
  onNotesChange,
  onRegenerateRejected,
  onReviewedByChange,
  onSelectBy,
  regenerateAvailable,
  reviewedBy,
  selectedCount,
  selectedRejectedCount,
}: RunVisualReviewSelectionControlsProps) {
  const decisionDisabled = busy || selectedCount === 0 || !reviewedBy.trim() || !notes.trim();
  return (
    <div className='bg-muted/10 grid gap-3 rounded-lg p-4'>
      <div className='flex flex-wrap gap-2'>
        <Button size='sm' variant='outline' onClick={() => onSelectBy("all")}>
          Select all
        </Button>
        <Button size='sm' variant='outline' onClick={() => onSelectBy("pending")}>
          Select pending
        </Button>
        <Button size='sm' variant='outline' onClick={() => onSelectBy("rejected")}>
          Select rejected
        </Button>
        <Button size='sm' variant='ghost' onClick={onClear}>
          Clear
        </Button>
      </div>
      <div className='grid gap-3 sm:grid-cols-2'>
        <Input
          aria-label='Visual reviewer'
          maxLength={200}
          placeholder='Reviewer'
          value={reviewedBy}
          onChange={(event) => onReviewedByChange(event.target.value)}
        />
        <Textarea
          aria-label='Visual review notes'
          maxLength={4_000}
          value={notes}
          onChange={(event) => onNotesChange(event.target.value)}
        />
      </div>
      <div className='flex flex-wrap gap-2'>
        <Button disabled={decisionDisabled} onClick={() => onDecide("approved")}>
          Approve selected ({selectedCount})
        </Button>
        <Button
          disabled={decisionDisabled}
          variant='destructive'
          onClick={() => onDecide("rejected")}
        >
          Reject selected
        </Button>
        <Button
          disabled={busy || selectedRejectedCount === 0 || !regenerateAvailable}
          variant='secondary'
          onClick={onRegenerateRejected}
        >
          Regenerate rejected ({selectedRejectedCount})
        </Button>
      </div>
    </div>
  );
}
