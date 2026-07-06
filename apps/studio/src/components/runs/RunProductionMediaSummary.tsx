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
    <div
      className='grid gap-4 rounded-lg bg-muted/10 p-4 lg:grid-cols-[minmax(0,1fr)_auto]'
      aria-label='Media review summary'
    >
      <div>
        <strong className='text-sm'>{summary.title}</strong>
        {summary.focus ? (
          <p className='mt-1 text-sm text-muted-foreground'>
            Next focus: {summary.focus.label} ({summary.focus.status}) — {summary.focus.action}
          </p>
        ) : (
          <p className='mt-1 text-sm text-muted-foreground'>
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
    <div className='rounded-md bg-background/45 p-2 text-center'>
      <dt className='text-xs text-muted-foreground'>{label}</dt>
      <dd className='mt-1 text-sm font-semibold'>{value}</dd>
    </div>
  );
}
