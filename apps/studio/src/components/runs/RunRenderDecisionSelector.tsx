import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
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
    <fieldset className='space-y-3'>
      <legend className='text-sm font-medium'>Decision</legend>
      <RadioGroup
        className='grid gap-3'
        value={decision}
        onValueChange={(value) => setDecisionFromRadioValue(value, commands, onDecisionChange)}
      >
        {commands.map((item) => (
          <Label
            className='grid cursor-pointer grid-cols-[auto_1fr] items-start gap-3 rounded-lg border bg-card p-3 text-sm transition-colors hover:bg-accent/10'
            key={item.decision}
          >
            <RadioGroupItem className='mt-1' value={item.decision} />
            <span className='space-y-2'>
              <strong className='block'>{formatRenderDecisionLabel(item.decision)}</strong>
              <span className='block text-muted-foreground'>{item.guidance}</span>
              <code className='block break-all rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground'>
                {item.command}
              </code>
            </span>
          </Label>
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
