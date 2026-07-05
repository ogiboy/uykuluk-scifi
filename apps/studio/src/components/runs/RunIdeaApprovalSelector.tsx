import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { StudioRunDetail } from "@/lib/runSummaries";

type RunIdeaApprovalSelectorProps = Readonly<{
  ideaId: string;
  ideas: StudioRunDetail["generatedIdeas"];
  onIdeaIdChange: (ideaId: string) => void;
}>;

/**
 * Renders generated idea choices for the guarded Studio idea approval action.
 *
 * @param ideaId - The currently selected idea identifier.
 * @param ideas - Generated idea summaries loaded from the run artifacts.
 * @param onIdeaIdChange - Callback used when the operator changes the selected idea.
 */
export function RunIdeaApprovalSelector({
  ideaId,
  ideas,
  onIdeaIdChange,
}: RunIdeaApprovalSelectorProps) {
  if (ideas.length === 0) {
    return (
      <Label className='grid gap-2'>
        <span>Idea ID</span>
        <Input
          maxLength={200}
          minLength={1}
          placeholder='idea_001'
          required
          value={ideaId}
          onChange={(event) => onIdeaIdChange(event.target.value)}
        />
      </Label>
    );
  }

  return (
    <fieldset className='space-y-3'>
      <legend className='text-sm font-medium'>Generated idea</legend>
      <RadioGroup className='grid gap-3' value={ideaId} onValueChange={onIdeaIdChange}>
        {ideas.map((idea) => (
          <Label
            className='grid cursor-pointer grid-cols-[auto_1fr] items-start gap-3 rounded-lg border bg-card p-3 text-sm transition-colors hover:bg-accent/10'
            key={idea.id}
          >
            <RadioGroupItem className='mt-1' value={idea.id} />
            <span className='space-y-2'>
              <strong className='block'>
                {idea.id}: {idea.title}
              </strong>
              {idea.premise ? (
                <span className='block text-muted-foreground'>{idea.premise}</span>
              ) : null}
              <span className='flex flex-wrap gap-2'>
                {idea.targetDuration ? (
                  <Badge variant='outline'>{idea.targetDuration}</Badge>
                ) : null}
                {idea.estimatedDifficulty ? (
                  <Badge variant='outline'>difficulty {idea.estimatedDifficulty}</Badge>
                ) : null}
                {idea.riskLevel ? <Badge variant='outline'>risk {idea.riskLevel}</Badge> : null}
              </span>
            </span>
          </Label>
        ))}
      </RadioGroup>
    </fieldset>
  );
}
