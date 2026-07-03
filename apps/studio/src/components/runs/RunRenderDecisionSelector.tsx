import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { StudioRunDetail } from "@/lib/runSummaries";

type RenderDecisionValue = StudioRunDetail["renderDecisionCommands"][number]["decision"];

type RunRenderDecisionSelectorProps = Readonly<{
  commands: StudioRunDetail["renderDecisionCommands"];
  decision: RenderDecisionValue;
  onDecisionChange: (decision: RenderDecisionValue) => void;
}>;

/**
 * Renders explicit render-decision choices for the guarded local review form.
 *
 * @param commands - Allowed decision templates projected from CLI/core.
 * @param decision - The selected local render decision.
 * @param onDecisionChange - Callback used after validating a selected decision.
 */
export function RunRenderDecisionSelector({
  commands,
  decision,
  onDecisionChange,
}: RunRenderDecisionSelectorProps) {
  return (
    <fieldset className='render-decision-selector'>
      <legend>Decision</legend>
      <RadioGroup
        value={decision}
        onValueChange={(value) => setDecisionFromRadioValue(value, commands, onDecisionChange)}
      >
        {commands.map((item) => (
          <label className='render-decision-option' key={item.decision}>
            <RadioGroupItem value={item.decision} />
            <span>
              <strong>{formatRenderDecisionLabel(item.decision)}</strong>
              <span>{item.guidance}</span>
              <code>{item.command}</code>
            </span>
          </label>
        ))}
      </RadioGroup>
    </fieldset>
  );
}

function setDecisionFromRadioValue(
  value: string,
  commands: StudioRunDetail["renderDecisionCommands"],
  setDecision: (decision: RenderDecisionValue) => void,
): void {
  const selected = commands.find((item) => item.decision === value);
  if (selected) {
    setDecision(selected.decision);
  }
}

function formatRenderDecisionLabel(decision: RenderDecisionValue): string {
  switch (decision) {
    case "accepted-for-local-review":
      return "Accept for local review";
    case "needs-revision":
      return "Needs revision";
    case "rejected":
      return "Reject draft";
  }
}
