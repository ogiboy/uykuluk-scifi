import Link from "next/link";
import type { Route } from "next";
import { RunQuickStageActionButton } from "@/components/runs/RunQuickStageActionButton";
import { CopyableCommand } from "@/components/studio/CopyableCommand";
import { StartIdeasActionPanel } from "@/components/studio/StartIdeasActionPanel";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildStudioRunPrimaryAction } from "@/lib/runPrimaryAction";
import {
  operatorBriefControlForAction,
  operatorBriefToneLabel,
} from "@/lib/operatorBriefPresentation";
import { runReviewHrefFromSummary } from "@/lib/runReviewNavigation";
import { NO_RUNS_NEXT_COMMAND } from "@/lib/runSummaryCopy";
import type { StudioRunSummary } from "@/lib/runSummaries";
import type { StartIdeasReadinessSummary } from "@/lib/startIdeasReadiness";

type OperatorBriefProps = Readonly<{
  latestRun: StudioRunSummary | null;
  startIdeasReadiness: StartIdeasReadinessSummary;
}>;

/**
 * Renders the first decision summary on the Studio control desk.
 *
 * This is display-only. Guarded routes and CLI/core remain authoritative for approvals, state
 * transitions, evidence writes, upload safety, publish safety, and provider execution.
 *
 * @param latestRun - Latest persisted local run, or null when no run exists yet.
 * @param startIdeasReadiness - Doctor-derived readiness for starting the first or next idea run.
 */
export function OperatorBrief({ latestRun, startIdeasReadiness }: OperatorBriefProps) {
  if (!latestRun) {
    return <EmptyOperatorBrief startIdeasReadiness={startIdeasReadiness} />;
  }

  const action = buildStudioRunPrimaryAction(latestRun);
  const control = operatorBriefControlForAction(action);
  const briefHref = runReviewHrefFromSummary(latestRun, "review-decision") as Route;
  return (
    <section aria-label='Operator brief'>
      <Card className='border-primary/20 bg-primary/5'>
        <CardHeader className='gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start'>
          <div className='min-w-0 space-y-1'>
            <p className='text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground'>
              Operator brief
            </p>
            <CardTitle>
              <span className='block truncate' title={latestRun.runId}>
                {latestRun.runId}
              </span>
            </CardTitle>
          </div>
          <Badge variant={action.tone === "blocked" ? "destructive" : "secondary"}>
            {operatorBriefToneLabel(action.tone)}
          </Badge>
        </CardHeader>
        <CardContent className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end'>
          <div className='grid gap-3 md:grid-cols-3'>
            <OperatorBriefFact label='Next safe action' value={action.label} />
            <OperatorBriefFact label='Current state' value={latestRun.state} />
            <OperatorBriefFact label='Safety boundary' value='CLI/core re-checks before writes' />
          </div>
          <div className='grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] lg:min-w-80'>
            <p className='text-sm text-muted-foreground'>{action.description}</p>
            {control === "stage-button" ? (
              <RunQuickStageActionButton label={action.label} run={latestRun} showResult />
            ) : null}
            {control === "copy-command" && action.command ? (
              <CopyableCommand command={action.command} label='Operator brief command' />
            ) : null}
            {control === "run-controls-link" || control === "done" ? (
              <Link className={buttonVariants({ variant: "default" })} href={briefHref}>
                Open run controls
              </Link>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function EmptyOperatorBrief({
  startIdeasReadiness,
}: Readonly<{ startIdeasReadiness: StartIdeasReadinessSummary }>) {
  return (
    <section aria-label='Operator brief'>
      <Card className='border-primary/20 bg-primary/5'>
        <CardHeader className='gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start'>
          <div className='space-y-1'>
            <p className='text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground'>
              Operator brief
            </p>
            <CardTitle>Start the first local run</CardTitle>
          </div>
          <Badge variant='secondary'>{startIdeasReadiness.label}</Badge>
        </CardHeader>
        <CardContent className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)] lg:items-start'>
          <StartIdeasActionPanel
            buttonLabel='Start first idea run'
            description='Create the first local idea run through the guarded Studio route. CLI/core still checks provider, budget, parser, and workflow gates before writing artifacts.'
            readiness={startIdeasReadiness}
          />
          <div className='space-y-2 rounded-xl bg-background/50 p-3'>
            <p className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
              CLI fallback
            </p>
            <CopyableCommand command={NO_RUNS_NEXT_COMMAND} label='First run command' />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function OperatorBriefFact({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className='min-w-0 rounded-xl bg-background/60 p-3'>
      <p className='text-xs font-medium text-muted-foreground'>{label}</p>
      <p className='mt-1 truncate font-semibold' title={value}>
        {value}
      </p>
    </div>
  );
}
