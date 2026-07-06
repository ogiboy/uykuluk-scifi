import { CliFallbackCommand } from "@/components/studio/CliFallbackCommand";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  buildStudioControlLoop,
  type StudioControlLoopItem,
  type StudioControlLoopRun,
  type StudioControlLoopTone,
} from "@/lib/studioControlLoop";

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
  const headingId = compact ? "home-guided-control-loop-heading" : "guided-control-loop-heading";
  const header = <ControlLoopHeader compact={compact} headingId={headingId} loop={loop} />;
  const body = <ControlLoopBody compact={compact} loop={loop} />;

  if (compact) {
    return (
      <section
        className='space-y-4 border-t border-border/10 pt-5 text-card-foreground'
        aria-labelledby={headingId}
      >
        {header}
        {body}
      </section>
    );
  }

  return (
    <section aria-labelledby={headingId}>
      <Card className='gap-5 bg-card/70 shadow-sm shadow-black/5'>
        <CardHeader>{header}</CardHeader>
        <CardContent className='space-y-4'>{body}</CardContent>
      </Card>
    </section>
  );
}

function ControlLoopHeader({
  compact,
  headingId,
  loop,
}: Readonly<{
  compact: boolean;
  headingId: string;
  loop: ReturnType<typeof buildStudioControlLoop>;
}>) {
  return (
    <div className='grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start'>
      <div className='min-w-0 space-y-1'>
        <p className='text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground'>
          Studio control loop
        </p>
        <h2
          className={cn("font-semibold tracking-tight", compact ? "text-base" : "text-xl")}
          id={headingId}
        >
          {loop.title}
        </h2>
      </div>
      <Badge variant={badgeVariant(loop.tone)}>{formatTone(loop.tone)}</Badge>
    </div>
  );
}

function ControlLoopBody({
  compact,
  loop,
}: Readonly<{ compact: boolean; loop: ReturnType<typeof buildStudioControlLoop> }>) {
  return (
    <>
      <p className='text-sm text-muted-foreground'>{loop.summary}</p>

      {loop.currentStep ? (
        <div
          className={cn(
            "grid gap-3 rounded-lg p-3 text-sm ring-1 sm:grid-cols-[auto_minmax(0,1fr)]",
            controlLoopItemSurfaceClass(compact, loop.currentStep.status === "blocked"),
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
        <p
          className={cn(
            "rounded-lg p-3 text-sm text-muted-foreground",
            compact ? "bg-muted/10" : "bg-muted/15",
          )}
        >
          Studio route: <code className='text-foreground'>{loop.nextAction.routePath}</code>
        </p>
      ) : null}

      {loop.nextAction.command ? (
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-3 rounded-lg p-4",
            compact ? "bg-muted/10" : "bg-muted/15",
          )}
        >
          <div className='grid gap-1 text-sm'>
            <strong>{loop.nextAction.routePath ? "CLI equivalent" : "Manual fallback"}</strong>
            <span className='text-muted-foreground'>
              {loop.nextAction.routePath
                ? "Web controls stay primary; reveal the equivalent only for audit or recovery."
                : "Reveal the manual command when this run cannot be advanced by a run-bound web action."}
            </span>
          </div>
          <CliFallbackCommand
            command={loop.nextAction.command}
            label='Control-loop action'
            triggerLabel={loop.nextAction.routePath ? "Show equivalent" : "Show command"}
          />
        </div>
      ) : null}

      <dl className='grid gap-3 md:grid-cols-2'>
        {loop.items.map((item) => (
          <div
            className={cn(
              "grid gap-2 rounded-lg p-3 text-sm",
              compact ? "bg-muted/10" : "bg-muted/15",
              item.tone === "blocked" && "bg-destructive/10 ring-1 ring-destructive/15",
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
    </>
  );
}

function controlLoopItemSurfaceClass(compact: boolean, blocked: boolean): string {
  if (blocked) {
    return "bg-destructive/10 ring-destructive/15";
  }
  return compact ? "bg-muted/10 ring-transparent" : "bg-muted/15 ring-transparent";
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
