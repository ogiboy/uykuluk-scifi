import { Badge } from "@/components/ui/badge";
import { CopyableCommand } from "@/components/studio/CopyableCommand";
import {
  buildStudioActionWorkbench,
  type StudioActionWorkbenchTone,
} from "@/lib/studioActionWorkbench";
import type { StudioRunDetail } from "@/lib/runSummaries";

type RunActionWorkbenchPanelProps = Readonly<{
  run: StudioRunDetail;
}>;

/**
 * Renders the primary operator action summary for the run detail rail.
 *
 * @param run - The Studio run detail projection used to select the current guarded action.
 */
export function RunActionWorkbenchPanel({ run }: RunActionWorkbenchPanelProps) {
  const workbench = buildStudioActionWorkbench(run);

  return (
    <section className='panel action-workbench' aria-labelledby='action-workbench-heading'>
      <div className='action-workbench-heading'>
        <div>
          <p className='eyebrow'>Action workbench</p>
          <h2 id='action-workbench-heading'>{workbench.primary.label}</h2>
        </div>
        <Badge variant={badgeVariant(workbench.primary.tone)}>
          {formatTone(workbench.primary.tone)}
        </Badge>
      </div>

      <p>{workbench.primary.description}</p>

      {workbench.primary.routePath ? (
        <p className='artifact-action'>Guarded route: {workbench.primary.routePath}</p>
      ) : null}

      {workbench.primary.command ? (
        <div className='operator-command-block'>
          <strong>CLI equivalent</strong>
          <CopyableCommand command={workbench.primary.command} label='Action command' />
        </div>
      ) : (
        <p className='artifact-description'>
          No command is recommended by the current persisted run state.
        </p>
      )}

      <dl className='action-workbench-boundaries'>
        {workbench.boundaries.map((boundary) => (
          <div key={boundary.label}>
            <dt>{boundary.label}</dt>
            <dd>{boundary.detail}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function badgeVariant(tone: StudioActionWorkbenchTone): "destructive" | "outline" | "secondary" {
  if (tone === "blocked") {
    return "destructive";
  }
  if (tone === "available" || tone === "complete") {
    return "secondary";
  }
  return "outline";
}

function formatTone(tone: StudioActionWorkbenchTone): string {
  switch (tone) {
    case "attention":
      return "attention";
    case "available":
      return "web action";
    case "blocked":
      return "blocked";
    case "cli-only":
      return "CLI";
    case "complete":
      return "complete";
  }
}
