import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { StudioVoiceAuditionSummary } from "@/lib/runs/voiceAuditionSummaries";

type VoiceReselectionControlProps = Readonly<{
  busy: boolean;
  open: boolean;
  reason: string;
  reviewer: string;
  selection: NonNullable<StudioVoiceAuditionSummary["currentSelection"]>;
  submitAvailable: boolean;
  onOpenChange: (open: boolean) => void;
  onReasonChange: (value: string) => void;
  onReviewerChange: (value: string) => void;
  onSubmit: () => void;
}>;

export function VoiceReselectionControl({
  busy,
  open,
  reason,
  reviewer,
  selection,
  submitAvailable,
  onOpenChange,
  onReasonChange,
  onReviewerChange,
  onSubmit,
}: VoiceReselectionControlProps) {
  return (
    <section className='bg-muted/10 ring-border/5 grid gap-3 rounded-lg p-4 ring-1'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <p className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
            Current selection
          </p>
          <h3 className='font-semibold'>{selection.name}</h3>
          <p className='text-muted-foreground text-sm'>Reviewed by {selection.reviewedBy}</p>
        </div>
        <Button
          disabled={busy || !submitAvailable}
          type='button'
          variant='outline'
          onClick={() => onOpenChange(!open)}
        >
          {open ? "Cancel reselection" : "Reselect voice"}
        </Button>
      </div>
      {open ? (
        <div className='grid gap-3 border-t pt-3'>
          <p className='text-muted-foreground text-sm'>
            Reselection archives unspent selection and quote evidence. It is blocked after a TTS
            reservation or synthesis attempt starts.
          </p>
          <div className='grid gap-3 md:grid-cols-2'>
            <div className='grid gap-2'>
              <Label htmlFor='voice-reselection-reviewer'>Reviewed by</Label>
              <Input
                id='voice-reselection-reviewer'
                maxLength={200}
                value={reviewer}
                onChange={(event) => onReviewerChange(event.target.value)}
              />
            </div>
            <div className='grid gap-2'>
              <Label htmlFor='voice-reselection-reason'>Reason</Label>
              <Textarea
                id='voice-reselection-reason'
                maxLength={1_000}
                rows={3}
                value={reason}
                onChange={(event) => onReasonChange(event.target.value)}
              />
            </div>
          </div>
          <Button
            className='justify-self-start'
            disabled={busy || !reviewer.trim() || !reason.trim()}
            type='button'
            variant='destructive'
            onClick={onSubmit}
          >
            Archive and reopen selection
          </Button>
        </div>
      ) : null}
    </section>
  );
}
