import type { Route } from "next";
import Link from "next/link";

import { RunGuidedControlLoopPanel } from "@/components/runs/RunGuidedControlLoopPanel";
import { RunPrimaryActionPanel } from "@/components/runs/RunPrimaryActionPanel";
import {
  operatorActionForRun,
  operatorActionToneLabel,
} from "@/components/runs/runSummaryOperatorAction";
import { ActiveRunActions } from "@/components/studio/ActiveRunActions";
import { MetricGrid, formatStudioInteger } from "@/components/studio/MetricGrid";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { runReviewHrefFromSummary } from "@/lib/runReviewNavigation";
import type { StudioRunSummary } from "@/lib/runSummaries";
import { formatRunRenderDecision, formatRunReviewCounts } from "@/lib/runSummaryCopy";

export function ActiveRunSnapshot({ run }: Readonly<{ run: StudioRunSummary }>) {
  const reviewHref = runReviewHrefFromSummary(run, "review-decision");
  const action = operatorActionForRun(run);
  const focusStep =
    run.workflowProgress.find((step) => step.status === "blocked") ??
    run.workflowProgress.find((step) => step.status === "current") ??
    run.workflowProgress.find((step) => step.status === "pending");
  const completedSteps = run.workflowProgress.filter((step) => step.status === "done").length;

  return (
    <Card>
      <CardHeader className='gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start'>
        <div className='min-w-0 space-y-2'>
          <p className='text-muted-foreground text-sm'>Active run</p>
          <CardTitle>
            <h3>Run snapshot</h3>
          </CardTitle>
          <p className='text-muted-foreground truncate text-sm font-medium' title={run.runId}>
            {run.runId}
          </p>
        </div>
        <div className='flex flex-wrap items-center gap-2 sm:justify-end'>
          <Badge variant={action.tone === "blocked" ? "destructive" : "secondary"}>
            {operatorActionToneLabel(action)}
          </Badge>
          <Link className={buttonVariants({ variant: "secondary" })} href={reviewHref as Route}>
            Open review
          </Link>
        </div>
      </CardHeader>
      <CardContent className='space-y-4'>
        <MetricGrid
          metrics={[
            { label: "State", value: run.state },
            { label: "Readiness", value: run.readinessStatus },
            { label: "Evidence", value: run.evidenceStatus },
            { label: "Progress", value: `${completedSteps}/${run.workflowProgress.length}` },
          ]}
        />

        <div className='bg-muted/10 grid gap-3 rounded-xl p-4 text-sm md:grid-cols-[auto_minmax(0,1fr)]'>
          <Badge variant={focusStep?.status === "blocked" ? "destructive" : "outline"}>
            {focusStep?.status ?? "review"}
          </Badge>
          <div className='space-y-1'>
            <strong>{focusStep?.label ?? "Review run detail"}</strong>
            <p className='text-muted-foreground'>
              {focusStep?.detail ??
                "Open the run workspace for artifacts, evidence, readiness, and review tabs."}
            </p>
          </div>
        </div>

        <p className='text-muted-foreground text-sm'>{formatRunReviewCounts(run)}</p>
      </CardContent>
    </Card>
  );
}

export function ActiveRunCard({ run }: Readonly<{ run: StudioRunSummary }>) {
  const decisionRailHref = runReviewHrefFromSummary(run, "review-decision");
  const currentSteps = run.workflowProgress.filter((step) =>
    ["blocked", "current"].includes(step.status),
  );
  const visibleCurrentSteps = currentSteps.slice(0, 4);
  const hiddenCurrentStepCount = Math.max(0, currentSteps.length - visibleCurrentSteps.length);
  const completedSteps = run.workflowProgress.filter((step) => step.status === "done").length;

  return (
    <Card>
      <CardHeader className='gap-4 sm:grid-cols-[1fr_auto]'>
        <div className='min-w-0 space-y-2'>
          <p className='text-muted-foreground text-sm'>Active run</p>
          <CardTitle>
            <span className='block truncate' title={run.runId}>
              {run.runId}
            </span>
          </CardTitle>
        </div>
        <ActiveRunActions run={run} />
      </CardHeader>
      <CardContent className='space-y-5'>
        <MetricGrid
          metrics={[
            { label: "State", value: run.state },
            { label: "Readiness", value: run.readinessStatus },
            { label: "Evidence", value: run.evidenceStatus },
            { label: "Render decision", value: formatRunRenderDecision(run) },
            { label: "Blocks", value: formatStudioInteger(run.blockedActionCount) },
            { label: "Progress", value: `${completedSteps}/${run.workflowProgress.length}` },
          ]}
        />

        <RunPrimaryActionPanel compact railHref={decisionRailHref} run={run} />
        <RunGuidedControlLoopPanel compact run={run} />
        <ol className='grid gap-3 md:grid-cols-2' aria-label='Current workflow attention'>
          {visibleCurrentSteps.length > 0 ? (
            visibleCurrentSteps.map((step) => (
              <li className='bg-muted/10 grid gap-1 rounded-lg p-3 text-sm' key={step.label}>
                <span className='flex flex-wrap items-center gap-2'>
                  <Badge variant={step.status === "blocked" ? "destructive" : "secondary"}>
                    {step.status}
                  </Badge>
                  <strong>{step.label}</strong>
                </span>
                <span className='text-muted-foreground'>{step.detail}</span>
              </li>
            ))
          ) : (
            <li className='bg-muted/10 grid gap-1 rounded-lg p-3 text-sm'>
              <strong>No active blocker</strong>
              <span className='text-muted-foreground'>
                Review the run detail before the next irreversible action.
              </span>
            </li>
          )}
          {hiddenCurrentStepCount > 0 ? (
            <li className='bg-muted/10 grid gap-1 rounded-lg p-3 text-sm'>
              <strong>+{hiddenCurrentStepCount} more</strong>
              <span className='text-muted-foreground'>Open the run detail for the full list.</span>
            </li>
          ) : null}
        </ol>

        <p className='text-muted-foreground text-sm'>{formatRunReviewCounts(run)}</p>
      </CardContent>
    </Card>
  );
}
