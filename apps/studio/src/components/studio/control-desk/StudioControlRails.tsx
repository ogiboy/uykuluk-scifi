import Link from "next/link";

import { HomeActionQueuePanel } from "@/components/studio/HomeActionQueuePanel";
import { StartIdeasActionPanel } from "@/components/studio/StartIdeasActionPanel";
import { StartNewRunPanel } from "@/components/studio/StartNewRunPanel";
import { StudioLastMutationNotice } from "@/components/studio/StudioLastMutationNotice";
import { StudioMutationSessionPanel } from "@/components/studio/StudioMutationSessionPanel";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StudioActionServiceStatus } from "@/lib/actionServiceStatus";
import { homeActionQueueSummaryItems } from "@/lib/actions/homeActionQueueSummary";
import type { startIdeasReadinessFromDoctor } from "@/lib/actions/startIdeasReadiness";
import type { StudioRunSummary } from "@/lib/runSummaries";

type StartIdeasReadiness = ReturnType<typeof startIdeasReadinessFromDoctor>;

export function HomeControlRail({
  actionStatus,
  runs,
  startIdeasReadiness,
}: Readonly<{
  actionStatus: StudioActionServiceStatus;
  runs: readonly StudioRunSummary[];
  startIdeasReadiness: StartIdeasReadiness;
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

            <p className='text-muted-foreground text-xs'>
              Upload, scheduling, public publish, and paid-provider execution stay disabled from the
              web surface.
            </p>
          </CardContent>
        </Card>
      </section>
    </aside>
  );
}

export function StudioSafetySummaryRail({
  actionStatus,
  latestRun,
  runs,
  startIdeasReadiness,
}: Readonly<{
  actionStatus: StudioActionServiceStatus;
  latestRun: StudioRunSummary | null;
  runs: readonly StudioRunSummary[];
  startIdeasReadiness: StartIdeasReadiness;
}>) {
  return (
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

function SafetyGateFact({
  label,
  tone,
  value,
}: Readonly<{ label: string; tone?: "blocked"; value: string }>) {
  return (
    <div className='bg-muted/10 grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-lg p-3'>
      <dt className='text-muted-foreground'>{label}</dt>
      <dd className={tone === "blocked" ? "text-destructive font-semibold" : "font-semibold"}>
        {value}
      </dd>
    </div>
  );
}
