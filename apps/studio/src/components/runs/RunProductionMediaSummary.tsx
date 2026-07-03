import type { ProductionMediaReviewSummary } from "@/lib/runEvidenceCopy";

type RunProductionMediaSummaryProps = Readonly<{
  summary: ProductionMediaReviewSummary;
}>;

/**
 * Renders aggregate production-media review counts and the next local focus.
 *
 * @param summary - The production-media review summary computed from current evidence.
 */
export function RunProductionMediaSummary({ summary }: RunProductionMediaSummaryProps) {
  return (
    <div className={`production-media-summary ${summary.tone}`} aria-label='Media review summary'>
      <div>
        <strong>{summary.title}</strong>
        {summary.focus ? (
          <p>
            Next focus: {summary.focus.label} ({summary.focus.status}) — {summary.focus.action}
          </p>
        ) : (
          <p>No local media rows are available for this run yet.</p>
        )}
      </div>
      <dl className='production-media-metrics'>
        <ProductionMediaMetric
          label='Verified'
          value={`${summary.verifiedCount}/${summary.totalCount}`}
        />
        <ProductionMediaMetric label='Missing' value={String(summary.missingCount)} />
        <ProductionMediaMetric label='Blocked' value={String(summary.blockedCount)} />
        <ProductionMediaMetric label='Record only' value={String(summary.recordedOnlyCount)} />
      </dl>
    </div>
  );
}

function ProductionMediaMetric({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
