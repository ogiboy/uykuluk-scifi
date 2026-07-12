import type { ProductionMediaReviewSummary } from "@/lib/runs/runEvidenceCopy";

type RunProductionMediaSummaryProps = Readonly<{ summary: ProductionMediaReviewSummary }>;

/**
 * Renders aggregate production-media review counts and the next local focus.
 *
 * @param summary - The production-media review summary computed from current evidence.
 */
export function RunProductionMediaSummary({ summary }: RunProductionMediaSummaryProps) {
  return (
    <div
      className='bg-muted/10 grid gap-4 rounded-lg p-4 lg:grid-cols-[minmax(0,1fr)_auto]'
      aria-label='Media review summary'
    >
      <div>
        <strong className='text-sm'>{summary.title}</strong>
        {summary.focus ? (
          <p className='text-muted-foreground mt-1 text-sm'>
            Next focus: {summary.focus.label} ({summary.focus.status}) — {summary.focus.action}
          </p>
        ) : (
          <p className='text-muted-foreground mt-1 text-sm'>
            No local media rows are available for this run yet.
          </p>
        )}
      </div>
      <dl className='grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-96'>
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
    <div className='bg-background/45 rounded-md p-2 text-center'>
      <dt className='text-muted-foreground text-xs'>{label}</dt>
      <dd className='mt-1 text-sm font-semibold'>{value}</dd>
    </div>
  );
}
