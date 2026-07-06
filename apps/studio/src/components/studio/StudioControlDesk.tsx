import Link from "next/link";
import type { Route } from "next";
import { RunPrimaryActionPanel } from "@/components/runs/RunPrimaryActionPanel";
import { RunGuidedControlLoopPanel } from "@/components/runs/RunGuidedControlLoopPanel";
import { ActiveRunActions } from "@/components/studio/ActiveRunActions";
import { formatStudioInteger, MetricGrid } from "@/components/studio/MetricGrid";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  operatorActionForRun,
  operatorActionToneLabel,
} from "@/components/runs/runSummaryOperatorAction";
import type { StudioRunSummary } from "@/lib/runSummaries";
import type { StudioDoctorOverview } from "@/lib/doctorOverview";
import { formatRunRenderDecision, formatRunReviewCounts } from "@/lib/runSummaryCopy";
import type { StudioActionServiceStatus } from "@/lib/actionServiceStatus";
import { startIdeasReadinessFromDoctor } from "@/lib/startIdeasReadiness";
import { runReviewHrefFromSummary } from "@/lib/runReviewNavigation";
import { homeActionQueueSummaryItems } from "@/lib/homeActionQueueSummary";
import { EmptyRunCard } from "./EmptyRunCard";
import { HomeActionQueuePanel } from "./HomeActionQueuePanel";
import { OperatorBrief } from "./OperatorBrief";
import { StudioLastMutationNotice } from "./StudioLastMutationNotice";
import { StartIdeasActionPanel } from "./StartIdeasActionPanel";
import { StartNewRunPanel } from "./StartNewRunPanel";
import { StudioMutationSessionPanel } from "./StudioMutationSessionPanel";

type StudioControlDeskProps = Readonly<{
  actionStatus: StudioActionServiceStatus;
  doctorOverview: StudioDoctorOverview;
  runs: readonly StudioRunSummary[];
  variant?: "compact" | "full";
}>;

/**
 * Renders the Studio home control surface for the current local production queue.
 *
 * @param actionStatus - Current guarded Studio action contract status.
 * @param doctorOverview - Latest persisted producer doctor overview.
 * @param runs - Persisted producer run summaries, newest first.
 * @param variant - Whether to render the compact home view or the full action workbench view.
 * @returns The first-screen operator control desk.
 */
export function StudioControlDesk({
  actionStatus,
  doctorOverview,
  runs,
  variant = "full",
}: StudioControlDeskProps) {
  const latestRun = runs[0] ?? null;
  const startIdeasReadiness = startIdeasReadinessFromDoctor(doctorOverview);
  const compact = variant === "compact";
  return (
    <section
      className={
        compact
          ? "grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]"
          : "grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]"
      }
      aria-labelledby='control-desk-heading'
    >
      <div className='grid min-w-0 content-start gap-4'>
        <div className='grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start'>
          <div className='space-y-2'>
            <p className='text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground'>
              Operator control desk
            </p>
            <h2 className='text-2xl font-semibold tracking-tight' id='control-desk-heading'>
              Current production queue
            </h2>
          </div>
          <Link className={buttonVariants({ variant: "secondary" })} href='/runs'>
            Open all runs
          </Link>
        </div>

        <OperatorBrief latestRun={latestRun} startIdeasReadiness={startIdeasReadiness} />

        {latestRun ? (
          compact ? (
            <ActiveRunSnapshot run={latestRun} />
          ) : (
            <ActiveRunCard run={latestRun} />
          )
        ) : (
          <EmptyRunCard readiness={startIdeasReadiness} />
        )}
      </div>

      {compact ? (
        <HomeControlRail
          actionStatus={actionStatus}
          runs={runs}
          startIdeasReadiness={startIdeasReadiness}
        />
      ) : (
        <aside
          className='grid min-w-0 content-start gap-4 lg:grid-cols-2 xl:grid-cols-1'
          aria-label='Studio safety and queue summary'
        >
          <StudioMutationSessionPanel />
          <StudioLastMutationNotice />
          {latestRun ? <StartNewRunPanel readiness={startIdeasReadiness} /> : null}
          <SafetyGateSummary actionStatus={actionStatus} />
          <HomeActionQueuePanel runs={runs} />
        </aside>
      )}
    </section>
  );
}

function ActiveRunSnapshot({ run }: Readonly<{ run: StudioRunSummary }>) {
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
          <p className='text-sm text-muted-foreground'>Active run</p>
          <CardTitle>
            <h3>Run snapshot</h3>
          </CardTitle>
          <p className='truncate text-sm font-medium text-muted-foreground' title={run.runId}>
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

        <div className='grid gap-3 rounded-xl bg-muted/10 p-4 text-sm md:grid-cols-[auto_minmax(0,1fr)]'>
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

        <p className='text-sm text-muted-foreground'>{formatRunReviewCounts(run)}</p>
      </CardContent>
    </Card>
  );
}

function ActiveRunCard({ run }: Readonly<{ run: StudioRunSummary }>) {
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
          <p className='text-sm text-muted-foreground'>Active run</p>
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
              <li className='grid gap-1 rounded-lg bg-muted/10 p-3 text-sm' key={step.label}>
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
            <li className='grid gap-1 rounded-lg bg-muted/10 p-3 text-sm'>
              <strong>No active blocker</strong>
              <span className='text-muted-foreground'>
                Review the run detail before the next irreversible action.
              </span>
            </li>
          )}
          {hiddenCurrentStepCount > 0 ? (
            <li className='grid gap-1 rounded-lg bg-muted/10 p-3 text-sm'>
              <strong>+{hiddenCurrentStepCount} more</strong>
              <span className='text-muted-foreground'>Open the run detail for the full list.</span>
            </li>
          ) : null}
        </ol>

        <p className='text-sm text-muted-foreground'>{formatRunReviewCounts(run)}</p>
      </CardContent>
    </Card>
  );
}

function HomeControlRail({
  actionStatus,
  runs,
  startIdeasReadiness,
}: Readonly<{
  actionStatus: StudioActionServiceStatus;
  runs: readonly StudioRunSummary[];
  startIdeasReadiness: ReturnType<typeof startIdeasReadinessFromDoctor>;
}>) {
  const queueItems = homeActionQueueSummaryItems(runs);
  const webActionCount = queueItems.find((item) => item.key === "webAction")?.value ?? 0;
  const blockedCount = queueItems.find((item) => item.key === "blockedCli")?.value ?? 0;
  const needsReviewCount = queueItems.find((item) => item.key === "needsReview")?.value ?? 0;

  return (
    <aside
      className='grid min-w-0 content-start gap-4'
      aria-label='Studio safety and queue summary'
    >
      <section aria-labelledby='home-shortcuts-heading'>
        <Card>
          <CardHeader>
            <CardTitle>
              <h3 id='home-shortcuts-heading'>Home shortcuts</h3>
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <dl className='grid gap-3 text-sm'>
              <SafetyGateFact label='Web-ready runs' value={String(webActionCount)} />
              <SafetyGateFact label='Needs review' value={String(needsReviewCount)} />
              <SafetyGateFact
                label='Blocked recovery'
                tone={blockedCount > 0 ? "blocked" : undefined}
                value={String(blockedCount)}
              />
              <SafetyGateFact
                label='Route findings'
                tone={actionStatus.findings.length > 0 ? "blocked" : undefined}
                value={String(actionStatus.findings.length)}
              />
            </dl>

            <div className='flex flex-wrap gap-2'>
              <StartIdeasActionPanel
                buttonLabel='Start idea run'
                presentation='button'
                readiness={startIdeasReadiness}
              />
              <Link className={buttonVariants({ variant: "secondary" })} href='/actions'>
                Actions
              </Link>
              <Link className={buttonVariants({ variant: "ghost" })} href='/runs'>
                Runs
              </Link>
            </div>

            <p className='text-xs text-muted-foreground'>
              Upload, scheduling, public publish, and paid-provider execution stay disabled from the
              web surface.
            </p>
          </CardContent>
        </Card>
      </section>
    </aside>
  );
}

function SafetyGateSummary({
  actionStatus,
}: Readonly<{ actionStatus: StudioActionServiceStatus }>) {
  const findingTone = actionStatus.findings.length > 0 ? "blocked" : undefined;

  return (
    <section aria-labelledby='safety-gates-heading'>
      <Card>
        <CardHeader>
          <CardTitle id='safety-gates-heading'>Safety gates</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className='grid gap-3 text-sm'>
            <SafetyGateFact
              label='Web actions'
              value={actionStatus.webMutationsEnabled ? "Guarded local routes" : "Disabled"}
            />
            <SafetyGateFact label='Upload / publish' tone='blocked' value='Disabled by default' />
            <SafetyGateFact
              label='Route findings'
              tone={findingTone}
              value={String(actionStatus.findings.length)}
            />
            <SafetyGateFact
              label='CLI-ready contracts'
              value={String(actionStatus.readyForCliCount)}
            />
          </dl>
        </CardContent>
      </Card>
    </section>
  );
}

type SafetyGateFactProps = Readonly<{
  label: string;
  tone?: "blocked";
  value: string;
}>;

function SafetyGateFact({ label, tone, value }: SafetyGateFactProps) {
  return (
    <div className='grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-lg bg-muted/10 p-3'>
      <dt className='text-muted-foreground'>{label}</dt>
      <dd className={tone === "blocked" ? "font-semibold text-destructive" : "font-semibold"}>
        {value}
      </dd>
    </div>
  );
}
