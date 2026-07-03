import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
      <label>
        Idea ID
        <Input
          maxLength={200}
          minLength={1}
          placeholder='idea_001'
          required
          value={ideaId}
          onChange={(event) => onIdeaIdChange(event.target.value)}
        />
      </label>
    );
  }

  return (
    <fieldset className='idea-approval-selector'>
      <legend>Generated idea</legend>
      <RadioGroup value={ideaId} onValueChange={onIdeaIdChange}>
        {ideas.map((idea) => (
          <label className='idea-approval-option' key={idea.id}>
            <RadioGroupItem value={idea.id} />
            <span>
              <strong>
                {idea.id}: {idea.title}
              </strong>
              {idea.premise ? <span>{idea.premise}</span> : null}
              <span className='idea-approval-meta'>
                {idea.targetDuration ? (
                  <Badge variant='outline'>{idea.targetDuration}</Badge>
                ) : null}
                {idea.estimatedDifficulty ? (
                  <Badge variant='outline'>difficulty {idea.estimatedDifficulty}</Badge>
                ) : null}
                {idea.riskLevel ? <Badge variant='outline'>risk {idea.riskLevel}</Badge> : null}
              </span>
            </span>
          </label>
        ))}
      </RadioGroup>
    </fieldset>
  );
}
