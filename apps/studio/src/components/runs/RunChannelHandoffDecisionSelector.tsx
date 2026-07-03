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
    <fieldset className='render-decision-selector'>
      <legend>Decision</legend>
      <RadioGroup
        value={decision}
        onValueChange={(value) => {
          if (isChannelHandoffDecision(value)) {
            onDecisionChange(value);
          }
        }}
      >
        {channelHandoffDecisionOptions.map((item) => (
          <label className='render-decision-option' key={item.decision}>
            <RadioGroupItem value={item.decision} />
            <span>
              <strong>{item.label}</strong>
              <span>{item.guidance}</span>
            </span>
          </label>
        ))}
      </RadioGroup>
    </fieldset>
  );
}

function isChannelHandoffDecision(value: string): value is ChannelHandoffDecisionValue {
  return channelHandoffDecisionOptions.some((item) => item.decision === value);
}
