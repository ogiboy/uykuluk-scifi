import Link from "next/link";
import { formatStudioInteger, MetricGrid } from "@/components/studio/MetricGrid";
import type { StudioRunSummary } from "@/lib/runSummaries";
import { formatRunReviewCounts } from "@/lib/runSummaryCopy";

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
    <section className='panel' aria-labelledby='latest-readiness-heading'>
      <div className='artifact-preview-header'>
        <div>
          <h2 id='latest-readiness-heading'>Latest Run Readiness</h2>
          <p className='artifact-description'>
            Read-only view of current CLI readiness. Studio does not approve or rerun checks.
          </p>
        </div>
        <Link className='status-pill small' href='/runs'>
          Open runs
        </Link>
      </div>

      {latestRun ? <LatestRunSummary latestRun={latestRun} /> : <NoRunsSummary />}
    </section>
  );
}

function LatestRunSummary({ latestRun }: Readonly<{ latestRun: StudioRunSummary }>) {
  return (
    <>
      <MetricGrid
        metrics={[
          { label: "Run", value: latestRun.runId },
          { label: "State", value: latestRun.state },
          { label: "Readiness", value: latestRun.readinessStatus },
          { label: "Evidence", value: latestRun.evidenceStatus },
          { label: "Blocks", value: formatStudioInteger(latestRun.blockedActionCount) },
          { label: "Updated", value: latestRun.updatedAt || "unknown" },
        ]}
      />
      <p className='artifact-description'>{formatRunReviewCounts(latestRun)}</p>
      <p>{latestRun.readinessMessage}</p>
      {latestRun.readinessNextAction ? (
        <p className='artifact-action'>Readiness action: {latestRun.readinessNextAction}</p>
      ) : null}
      <div className='artifact-action'>
        <strong>Next safe action</strong>
        <code className='command'>
          {latestRun.nextRecommendedCommand ?? `pnpm producer evidence --run ${latestRun.runId}`}
        </code>
      </div>
      <Link className='status-pill small' href={`/runs/${latestRun.runId}`}>
        Review latest run
      </Link>
    </>
  );
}

function NoRunsSummary() {
  return (
    <>
      <MetricGrid metrics={[{ label: "Runs", value: "0" }]} />
      <div className='artifact-action'>
        <strong>Next safe action</strong>
        <code className='command'>pnpm producer ideas</code>
      </div>
      <p>Start a run from the CLI; Studio will only display persisted local state.</p>
    </>
  );
}
