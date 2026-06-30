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
    <section className='panel' aria-labelledby='render-decision-commands-heading'>
      <h2 id='render-decision-commands-heading'>Local Render Decision</h2>
      <p>
        After watching the local draft MP4, record exactly one durable CLI decision. These commands
        do not approve upload or publish.
      </p>
      <ul>
        {commands.map((item) => (
          <li key={item.decision}>
            <strong>{item.decision}</strong>
            <p>{item.guidance}</p>
            <code className='command'>{item.command}</code>
          </li>
        ))}
      </ul>
    </section>
  );
}
