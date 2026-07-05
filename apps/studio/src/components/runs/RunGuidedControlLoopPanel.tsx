import { Badge } from "@/components/ui/badge";
import {
  buildStudioControlLoop,
  type StudioControlLoopRun,
  type StudioControlLoopTone,
} from "@/lib/studioControlLoop";
import { CopyableCommand } from "../studio/CopyableCommand";

type RunGuidedControlLoopPanelProps = Readonly<{
  compact?: boolean;
  run: StudioControlLoopRun;
}>;

/**
 * Renders the primary Studio-native control-loop summary for a run.
 *
 * @param compact - Whether the panel is rendered in the home-page active-run card.
 * @param run - The Studio run projection used to build the control-loop decision model.
 */
export function RunGuidedControlLoopPanel({
  compact = false,
  run,
}: RunGuidedControlLoopPanelProps) {
  const loop = buildStudioControlLoop(run);

  return (
    <section
      className={compact ? "guided-control-loop compact" : "guided-control-loop"}
      aria-labelledby={compact ? "home-guided-control-loop-heading" : "guided-control-loop-heading"}
    >
      <div className='guided-control-loop-heading'>
        <div>
          <p className='eyebrow'>Studio control loop</p>
          <h2 id={compact ? "home-guided-control-loop-heading" : "guided-control-loop-heading"}>
            {loop.title}
          </h2>
        </div>
        <Badge variant={badgeVariant(loop.tone)}>{formatTone(loop.tone)}</Badge>
      </div>

      <p>{loop.summary}</p>

      {loop.currentStep ? (
        <div className={`guided-control-loop-step ${loop.currentStep.status}`}>
          <span className='status-pill small'>{loop.currentStep.status}</span>
          <div>
            <strong>{loop.currentStep.label}</strong>
            <p>{loop.currentStep.detail}</p>
          </div>
        </div>
      ) : null}

      {loop.nextAction.routePath ? (
        <p className='artifact-action'>Studio route: {loop.nextAction.routePath}</p>
      ) : null}

      {loop.nextAction.command ? (
        <div className='operator-command-block secondary-command'>
          <strong>{loop.nextAction.routePath ? "CLI equivalent" : "Manual/CLI action"}</strong>
          <CopyableCommand command={loop.nextAction.command} label='Control-loop action' />
        </div>
      ) : null}

      <dl className='guided-control-loop-items'>
        {loop.items.map((item) => (
          <div data-tone={item.tone} key={item.label}>
            <dt>
              <span className={`status-pill small ${item.tone}`}>{item.tone}</span>
              {item.label}
            </dt>
            <dd>{item.detail}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function badgeVariant(tone: StudioControlLoopTone): "destructive" | "outline" | "secondary" {
  if (tone === "blocked") {
    return "destructive";
  }
  if (tone === "web-action" || tone === "complete") {
    return "secondary";
  }
  return "outline";
}

function formatTone(tone: StudioControlLoopTone): string {
  switch (tone) {
    case "blocked":
      return "blocked";
    case "cli-only":
      return "CLI";
    case "complete":
      return "complete";
    case "web-action":
      return "web action";
  }
}
