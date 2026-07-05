import Link from "next/link";
import { RunPrimaryActionPanel } from "@/components/runs/RunPrimaryActionPanel";
import { RunGuidedControlLoopPanel } from "@/components/runs/RunGuidedControlLoopPanel";
import { ActiveRunActions } from "@/components/studio/ActiveRunActions";
import { formatStudioInteger, MetricGrid } from "@/components/studio/MetricGrid";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StudioRunSummary } from "@/lib/runSummaries";
import type { StudioDoctorOverview } from "@/lib/doctorOverview";
import { formatRunRenderDecision, formatRunReviewCounts } from "@/lib/runSummaryCopy";
import type { StudioActionServiceStatus } from "@/lib/actionServiceStatus";
import { startIdeasReadinessFromDoctor } from "@/lib/startIdeasReadiness";
import { runReviewHrefFromSummary } from "@/lib/runReviewNavigation";
import { EmptyRunCard } from "./EmptyRunCard";
import { HomeActionQueuePanel } from "./HomeActionQueuePanel";
import { StudioLastMutationNotice } from "./StudioLastMutationNotice";
import { StartNewRunPanel } from "./StartNewRunPanel";
import { StudioMutationSessionPanel } from "./StudioMutationSessionPanel";

type StudioControlDeskProps = Readonly<{
  actionStatus: StudioActionServiceStatus;
  doctorOverview: StudioDoctorOverview;
  runs: readonly StudioRunSummary[];
}>;

/**
 * Renders the Studio home control surface for the current local production queue.
 *
 * @param actionStatus - Current guarded Studio action contract status.
 * @param doctorOverview - Latest persisted producer doctor overview.
 * @param runs - Persisted producer run summaries, newest first.
 * @returns The first-screen operator control desk.
 */
export function StudioControlDesk({ actionStatus, doctorOverview, runs }: StudioControlDeskProps) {
  const latestRun = runs[0] ?? null;
  const startIdeasReadiness = startIdeasReadinessFromDoctor(doctorOverview);
  return (
    <section
      className='grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]'
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

        {latestRun ? (
          <ActiveRunCard run={latestRun} />
        ) : (
          <EmptyRunCard readiness={startIdeasReadiness} />
        )}
      </div>

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
    </section>
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
              <li className='grid gap-1 rounded-lg border bg-muted/20 p-3 text-sm' key={step.label}>
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
            <li className='grid gap-1 rounded-lg border bg-muted/20 p-3 text-sm'>
              <strong>No active blocker</strong>
              <span className='text-muted-foreground'>
                Review the run detail before the next irreversible action.
              </span>
            </li>
          )}
          {hiddenCurrentStepCount > 0 ? (
            <li className='grid gap-1 rounded-lg border bg-muted/20 p-3 text-sm'>
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
    <div className='grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-lg border bg-muted/20 p-3'>
      <dt className='text-muted-foreground'>{label}</dt>
      <dd className={tone === "blocked" ? "font-semibold text-destructive" : "font-semibold"}>
        {value}
      </dd>
    </div>
  );
}
