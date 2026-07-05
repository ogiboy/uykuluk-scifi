import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export type ChannelHandoffDecisionValue =
  "accepted-for-manual-channel-prep" | "needs-revision" | "rejected";

type RunChannelHandoffDecisionSelectorProps = Readonly<{
  decision: ChannelHandoffDecisionValue;
  onDecisionChange: (decision: ChannelHandoffDecisionValue) => void;
}>;

const channelHandoffDecisionOptions = [
  {
    decision: "accepted-for-manual-channel-prep",
    guidance:
      "Use only after reviewing the MP4, subtitles, metadata, chapters, and thumbnail candidate.",
    label: "Accept for manual channel prep",
  },
  {
    decision: "needs-revision",
    guidance: "Use when the handoff is usable as evidence but needs upstream revision first.",
    label: "Needs revision",
  },
  {
    decision: "rejected",
    guidance: "Use when this handoff should not be used for upload-prep work.",
    label: "Reject handoff",
  },
] as const satisfies readonly {
  decision: ChannelHandoffDecisionValue;
  guidance: string;
  label: string;
}[];

/**
 * Renders explicit manual channel-handoff decision choices for the guarded local review form.
 *
 * @param decision - The selected local channel-handoff decision.
 * @param onDecisionChange - Callback used after validating a selected decision.
 */
export function RunChannelHandoffDecisionSelector({
  decision,
  onDecisionChange,
}: RunChannelHandoffDecisionSelectorProps) {
  return (
    <fieldset className='space-y-3'>
      <legend className='text-sm font-medium'>Decision</legend>
      <RadioGroup
        className='grid gap-3'
        value={decision}
        onValueChange={(value) => {
          if (isChannelHandoffDecision(value)) {
            onDecisionChange(value);
          }
        }}
      >
        {channelHandoffDecisionOptions.map((item) => (
          <Label
            className='grid cursor-pointer grid-cols-[auto_1fr] items-start gap-3 rounded-lg border bg-card p-3 text-sm transition-colors hover:bg-accent/10'
            key={item.decision}
          >
            <RadioGroupItem className='mt-1' value={item.decision} />
            <span className='space-y-2'>
              <strong className='block'>{item.label}</strong>
              <span className='block text-muted-foreground'>{item.guidance}</span>
            </span>
          </Label>
        ))}
      </RadioGroup>
    </fieldset>
  );
}

function isChannelHandoffDecision(value: string): value is ChannelHandoffDecisionValue {
  return channelHandoffDecisionOptions.some((item) => item.decision === value);
}
