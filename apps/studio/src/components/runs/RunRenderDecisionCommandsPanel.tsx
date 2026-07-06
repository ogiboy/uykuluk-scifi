import { RunDetailCard } from "@/components/runs/RunDetailCard";
import { CopyableCommand } from "@/components/studio/CopyableCommand";
import { Badge } from "@/components/ui/badge";
import type { StudioRunDetail } from "@/lib/runSummaries";

type RunRenderDecisionCommandsPanelProps = Readonly<{
  commands: StudioRunDetail["renderDecisionCommands"];
}>;

/**
 * Renders local render-decision command templates for a rendered run.
 *
 * @param commands - Read-only CLI command templates exposed by the Studio run detail service.
 */
export function RunRenderDecisionCommandsPanel({ commands }: RunRenderDecisionCommandsPanelProps) {
  if (commands.length === 0) {
    return null;
  }

  return (
    <RunDetailCard
      headingId='render-decision-commands-heading'
      title='Local Render Decision'
      description='After watching the local draft MP4, record exactly one durable operator decision. These fallbacks do not approve upload or publish.'
    >
      <ul className='grid gap-3'>
        {commands.map((item) => (
          <li className='grid gap-3 rounded-lg bg-muted/10 p-3' key={item.decision}>
            <Badge className='capitalize' variant='outline'>
              {item.decision}
            </Badge>
            <p className='text-sm text-muted-foreground'>{item.guidance}</p>
            <CopyableCommand command={item.command} label={`${item.decision} decision command`} />
          </li>
        ))}
      </ul>
    </RunDetailCard>
  );
}
