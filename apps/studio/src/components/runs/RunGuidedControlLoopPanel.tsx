import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  buildStudioControlLoop,
  type StudioControlLoopItem,
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
      className={cn(
        "space-y-4 rounded-xl bg-card text-card-foreground ring-1 ring-border/10",
        compact ? "p-4 shadow-none" : "p-6 shadow-sm",
      )}
      aria-labelledby={compact ? "home-guided-control-loop-heading" : "guided-control-loop-heading"}
    >
      <div className='grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start'>
        <div className='min-w-0 space-y-1'>
          <p className='text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground'>
            Studio control loop
          </p>
          <h2
            className={cn("font-semibold tracking-tight", compact ? "text-base" : "text-xl")}
            id={compact ? "home-guided-control-loop-heading" : "guided-control-loop-heading"}
          >
            {loop.title}
          </h2>
        </div>
        <Badge variant={badgeVariant(loop.tone)}>{formatTone(loop.tone)}</Badge>
      </div>

      <p className='text-sm text-muted-foreground'>{loop.summary}</p>

      {loop.currentStep ? (
        <div
          className={cn(
            "grid gap-3 rounded-lg p-3 text-sm ring-1 sm:grid-cols-[auto_minmax(0,1fr)]",
            loop.currentStep.status === "blocked"
              ? "bg-destructive/10 ring-destructive/20"
              : "bg-muted/20 ring-border/10",
          )}
        >
          <Badge variant={loop.currentStep.status === "blocked" ? "destructive" : "secondary"}>
            {loop.currentStep.status}
          </Badge>
          <div className='space-y-1'>
            <strong>{loop.currentStep.label}</strong>
            <p className='text-muted-foreground'>{loop.currentStep.detail}</p>
          </div>
        </div>
      ) : null}

      {loop.nextAction.routePath ? (
        <p className='rounded-lg bg-muted/20 p-3 text-sm text-muted-foreground ring-1 ring-border/10'>
          Studio route: <code className='text-foreground'>{loop.nextAction.routePath}</code>
        </p>
      ) : null}

      {loop.nextAction.command ? (
        <div className='grid gap-2 rounded-lg bg-muted/20 p-4 ring-1 ring-border/10'>
          <strong className='text-sm'>
            {loop.nextAction.routePath ? "CLI equivalent" : "Manual/CLI action"}
          </strong>
          <CopyableCommand command={loop.nextAction.command} label='Control-loop action' />
        </div>
      ) : null}

      <dl className='grid gap-3 md:grid-cols-2'>
        {loop.items.map((item) => (
          <div
            className={cn(
              "grid gap-2 rounded-lg bg-muted/20 p-3 text-sm ring-1 ring-border/10",
              item.tone === "blocked" && "bg-destructive/10 ring-destructive/20",
            )}
            data-tone={item.tone}
            key={item.label}
          >
            <dt className='flex flex-wrap items-center gap-2 font-medium'>
              <Badge variant={itemBadgeVariant(item.tone)}>{item.tone}</Badge>
              <span>{item.label}</span>
            </dt>
            <dd className='text-muted-foreground'>{item.detail}</dd>
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

function itemBadgeVariant(
  tone: StudioControlLoopItem["tone"],
): "destructive" | "outline" | "secondary" {
  if (tone === "blocked") {
    return "destructive";
  }
  if (tone === "done" || tone === "ready") {
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
