import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { HeadphonesIcon } from "lucide-react";

type VoiceSelectionFormProps = Readonly<{
  busy: boolean;
  candidateName: string;
  confirmProductionRights: boolean;
  notes: string;
  reviewedBy: string;
  submitAvailable: boolean;
  onCancel: () => void;
  onConfirmProductionRightsChange: (checked: boolean) => void;
  onNotesChange: (value: string) => void;
  onReviewedByChange: (value: string) => void;
  onSubmit: () => void;
}>;

export function VoiceSelectionForm({
  busy,
  candidateName,
  confirmProductionRights,
  notes,
  reviewedBy,
  submitAvailable,
  onCancel,
  onConfirmProductionRightsChange,
  onNotesChange,
  onReviewedByChange,
  onSubmit,
}: VoiceSelectionFormProps) {
  const formReady = reviewedBy.trim().length > 0 && notes.trim().length > 0;
  return (
    <section
      className='border-primary/30 bg-primary/5 grid gap-4 rounded-lg border p-4'
      aria-labelledby='voice-selection-form-heading'
    >
      <div>
        <h3 className='font-semibold' id='voice-selection-form-heading'>
          Select {candidateName}
        </h3>
        <p className='text-muted-foreground mt-1 text-sm'>
          Record who reviewed the local preview and why. Selection does not approve cost or execute
          production synthesis.
        </p>
      </div>
      <div className='grid gap-4 md:grid-cols-2'>
        <div className='grid gap-2'>
          <Label htmlFor='voice-reviewed-by'>Reviewed by</Label>
          <Input
            id='voice-reviewed-by'
            maxLength={200}
            value={reviewedBy}
            onChange={(event) => onReviewedByChange(event.target.value)}
          />
        </div>
        <div className='flex items-start gap-2 pt-7'>
          <Checkbox
            checked={confirmProductionRights}
            id='voice-production-rights'
            onCheckedChange={(checked) => onConfirmProductionRightsChange(checked === true)}
          />
          <Label className='leading-snug' htmlFor='voice-production-rights'>
            I confirm that production usage rights have been reviewed when the selected tier
            requires them.
          </Label>
        </div>
      </div>
      <div className='grid gap-2'>
        <Label htmlFor='voice-selection-notes'>Audition notes</Label>
        <Textarea
          id='voice-selection-notes'
          maxLength={4_000}
          rows={4}
          value={notes}
          onChange={(event) => onNotesChange(event.target.value)}
        />
      </div>
      <div className='flex flex-wrap gap-2'>
        <Button disabled={busy || !submitAvailable || !formReady} type='button' onClick={onSubmit}>
          <HeadphonesIcon /> Record selection
        </Button>
        <Button disabled={busy} type='button' variant='outline' onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </section>
  );
}
