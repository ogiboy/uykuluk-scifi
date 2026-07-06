import Link from "next/link";
import type { Route } from "next";
import { CliFallbackCommand } from "@/components/studio/CliFallbackCommand";
import { formatStudioInteger, MetricGrid } from "@/components/studio/MetricGrid";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { runReviewHrefFromSummary } from "@/lib/runReviewNavigation";
import type { StudioRunSummary } from "@/lib/runSummaries";
import {
  formatRunRenderDecision,
  formatRunReviewCounts,
  getNextSafeCommand,
} from "@/lib/runSummaryCopy";

type LatestRunReadinessPanelProps = Readonly<{
  latestRun: StudioRunSummary | null;
}>;

/**
 * Renders the latest run readiness summary on the Studio home page.
 *
 * @param latestRun - The most recently updated run summary, or `null` when no runs exist.
 * @returns A read-only latest-run readiness panel.
 */
export function LatestRunReadinessPanel({ latestRun }: LatestRunReadinessPanelProps) {
  return (
    <section aria-labelledby='latest-readiness-heading'>
      <Card>
        <CardHeader className='gap-4 sm:grid-cols-[1fr_auto]'>
          <div className='space-y-2'>
            <CardTitle id='latest-readiness-heading'>Latest Run Readiness</CardTitle>
            <CardDescription>
              Read-only view of current CLI readiness. Studio does not approve or rerun checks.
            </CardDescription>
          </div>
          <Link className={buttonVariants({ variant: "secondary" })} href='/runs'>
            Open runs
          </Link>
        </CardHeader>
        <CardContent className='space-y-4'>
          {latestRun ? <LatestRunSummary latestRun={latestRun} /> : <NoRunsSummary />}
        </CardContent>
      </Card>
    </section>
  );
}

function LatestRunSummary({ latestRun }: Readonly<{ latestRun: StudioRunSummary }>) {
  const reviewHref = runReviewHrefFromSummary(latestRun) as Route;

  return (
    <>
      <MetricGrid
        metrics={[
          { label: "Run", value: latestRun.runId },
          { label: "State", value: latestRun.state },
          { label: "Readiness", value: latestRun.readinessStatus },
          { label: "Evidence", value: latestRun.evidenceStatus },
          { label: "Decision", value: formatRunRenderDecision(latestRun) },
          { label: "Blocks", value: formatStudioInteger(latestRun.blockedActionCount) },
          { label: "Updated", value: latestRun.updatedAt || "unknown" },
        ]}
      />
      <p className='text-sm text-muted-foreground'>{formatRunReviewCounts(latestRun)}</p>
      <p className='text-sm'>{latestRun.readinessMessage}</p>
      {latestRun.readinessNextAction ? (
        <p className='rounded-lg bg-muted/10 p-3 text-sm text-muted-foreground'>
          Readiness action: {latestRun.readinessNextAction}
        </p>
      ) : null}
      <div className='space-y-3 rounded-lg bg-muted/10 p-3'>
        <strong className='text-sm'>Next safe action</strong>
        <CliFallbackCommand
          align='start'
          command={getNextSafeCommand(latestRun)}
          label='Next safe action'
        />
      </div>
      <Link className={buttonVariants({ variant: "secondary" })} href={reviewHref}>
        Review latest run
      </Link>
    </>
  );
}

function NoRunsSummary() {
  return (
    <>
      <MetricGrid metrics={[{ label: "Runs", value: "0" }]} />
      <p className='text-sm text-muted-foreground'>
        Start the first idea run from the guarded control desk action. CLI/core still owns the
        workflow state and evidence written after that action completes.
      </p>
    </>
  );
}
