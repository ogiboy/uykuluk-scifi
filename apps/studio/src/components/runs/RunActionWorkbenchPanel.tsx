import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <section aria-labelledby='action-workbench-heading'>
      <Card>
        <CardHeader className='gap-4 sm:grid-cols-[1fr_auto]'>
          <div className='space-y-2'>
            <p className='text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground'>
              Action workbench
            </p>
            <CardTitle id='action-workbench-heading'>{workbench.primary.label}</CardTitle>
          </div>
          <Badge
            className='justify-self-start sm:justify-self-end'
            variant={badgeVariant(workbench.primary.tone)}
          >
            {formatTone(workbench.primary.tone)}
          </Badge>
        </CardHeader>
        <CardContent className='space-y-5'>
          <p className='text-sm text-muted-foreground'>{workbench.primary.description}</p>

          {workbench.primary.routePath ? (
            <code className='block max-w-full break-all rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground'>
              Guarded route: {workbench.primary.routePath}
            </code>
          ) : null}

          {workbench.primary.command ? (
            <div className='space-y-2 rounded-lg bg-muted/20 p-3 ring-1 ring-border/10'>
              <strong className='text-sm'>CLI equivalent</strong>
              <CopyableCommand command={workbench.primary.command} label='Action command' />
            </div>
          ) : (
            <p className='text-sm text-muted-foreground'>
              No command is recommended by the current persisted run state.
            </p>
          )}

          <dl className='grid gap-3 text-sm sm:grid-cols-2'>
            {workbench.boundaries.map((boundary) => (
              <div
                className='space-y-1 rounded-lg bg-muted/20 p-3 ring-1 ring-border/10'
                key={boundary.label}
              >
                <dt className='font-medium text-muted-foreground'>{boundary.label}</dt>
                <dd>{boundary.detail}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
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
