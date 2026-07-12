"use client";

import { RunQuickStageActionButton } from "@/components/runs/RunQuickStageActionButton";
import {
  operatorActionDetail,
  operatorActionForRun,
  operatorActionToneLabel,
  type OperatorAction,
} from "@/components/runs/runSummaryOperatorAction";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { homeActionQueueSummaryItems } from "@/lib/actions/homeActionQueueSummary";
import { runReviewHrefFromSummary } from "@/lib/runs/runReviewNavigation";
import type { StudioRunSummary } from "@/lib/runSummaries";
import type { Route } from "next";
import Link from "next/link";

type HomeActionQueuePanelProps = Readonly<{ runs: readonly StudioRunSummary[] }>;

/**
 * Renders a compact action-prioritized queue for the Studio home rail.
 *
 * @param runs - Persisted local run summaries, newest first.
 * @returns A prioritized operator queue for the next safe web or detail action.
 */
export function HomeActionQueuePanel({ runs }: HomeActionQueuePanelProps) {
  return (
    <section aria-labelledby='home-action-queue-heading'>
      <Card>
        <CardHeader className='gap-4 sm:grid-cols-[1fr_auto]'>
          <div className='space-y-2'>
            <CardTitle id='home-action-queue-heading'>Action queue</CardTitle>
            <p className='text-muted-foreground text-sm'>
              Prioritized from persisted CLI/core run summaries.
            </p>
          </div>
          <Link className={buttonVariants({ variant: "secondary" })} href='/runs'>
            All runs
          </Link>
        </CardHeader>
        <CardContent className='space-y-5'>
          {runs.length > 0 ? (
            <>
              <HomeActionQueueSummary runs={runs} />
              <HomeActionQueueList runs={runs} />
            </>
          ) : (
            <p className='text-muted-foreground text-sm'>No persisted runs found.</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function HomeActionQueueSummary({ runs }: HomeActionQueuePanelProps) {
  return (
    <dl
      className='grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4'
      aria-label='Home action queue summary'
    >
      {homeActionQueueSummaryItems(runs).map((item) => (
        <div className='bg-muted/25 rounded-xl p-3' key={item.key} data-tone={item.tone}>
          <dt className='text-muted-foreground text-xs font-medium'>{item.label}</dt>
          <dd className='mt-1 text-lg font-semibold'>{item.value}</dd>
          <small className='text-muted-foreground mt-1 block'>{item.detail}</small>
        </div>
      ))}
    </dl>
  );
}

function HomeActionQueueList({ runs }: HomeActionQueuePanelProps) {
  return (
    <ol className='grid gap-3'>
      {prioritizedActionRuns(runs)
        .slice(0, 5)
        .map(({ action, run }) => (
          <li key={run.runId}>
            <div className='bg-muted/25 grid gap-3 rounded-xl p-3'>
              <div className='min-w-0 space-y-1'>
                <Link
                  className='block truncate font-semibold underline-offset-4 hover:underline'
                  href={runReviewHrefFromSummary(run) as Route}
                  title={run.runId}
                >
                  <strong>{run.runId}</strong>
                </Link>
                <span className='text-muted-foreground block text-sm'>
                  {run.state} · {operatorActionDetail(action)}
                </span>
                <small className='text-muted-foreground block'>{action.label}</small>
              </div>
              <div className='flex flex-wrap items-center gap-2'>
                <Badge variant={action.tone === "blocked" ? "destructive" : "secondary"}>
                  {operatorActionToneLabel(action)}
                </Badge>
                <RunQuickStageActionButton label={action.label} run={run} variant='secondary' />
                <Link
                  className={buttonVariants({ variant: "ghost" })}
                  href={runReviewHrefFromSummary(run, "review-decision") as Route}
                >
                  Open
                </Link>
              </div>
            </div>
          </li>
        ))}
    </ol>
  );
}

function prioritizedActionRuns(runs: readonly StudioRunSummary[]) {
  return runs
    .map((run) => ({ action: operatorActionForRun(run), run }))
    .sort(
      (left, right) =>
        actionTonePriority(left.action) - actionTonePriority(right.action) ||
        right.run.updatedAt.localeCompare(left.run.updatedAt),
    );
}

function actionTonePriority(action: OperatorAction): number {
  switch (action.tone) {
    case "available":
      return 0;
    case "blocked":
      return 1;
    case "attention":
    case "cli-only":
      return 2;
    case "complete":
      return 3;
  }
}
