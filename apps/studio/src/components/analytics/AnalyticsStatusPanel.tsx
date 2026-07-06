import Link from "next/link";
import type { StudioAnalyticsOverview } from "@/lib/analyticsOverview";
import { formatStudioInteger, MetricGrid } from "@/components/studio/MetricGrid";
import { CopyableCommand } from "@/components/studio/CopyableCommand";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type AnalyticsStatusPanelProps = Readonly<{
  overview: StudioAnalyticsOverview;
}>;

/**
 * Renders a compact manual analytics summary on the Studio home page.
 *
 * @param overview - The local analytics overview loaded from ignored operator artifacts.
 * @returns A read-only analytics status panel.
 */
export function AnalyticsStatusPanel({ overview }: AnalyticsStatusPanelProps) {
  return (
    <section aria-labelledby='analytics-status-heading'>
      <Card>
        <CardHeader className='gap-4 sm:grid-cols-[1fr_auto]'>
          <div className='space-y-2'>
            <CardTitle id='analytics-status-heading'>Analytics Feedback</CardTitle>
            <CardDescription>
              Manual import only. Studio reads local artifacts and does not call YouTube APIs.
            </CardDescription>
          </div>
          <Link className={buttonVariants({ variant: "secondary" })} href='/analytics'>
            Open analytics
          </Link>
        </CardHeader>
        <CardContent className='space-y-4'>
          <MetricGrid
            metrics={[
              { label: "Status", value: overview.status },
              { label: "Records", value: formatStudioInteger(overview.recordCount) },
              { label: "Mapped runs", value: formatStudioInteger(overview.mappedRunCount) },
              { label: "Report", value: overview.reportStatus },
            ]}
          />
          <p className='text-sm text-muted-foreground'>
            {overview.dataQuality.nextDataQualityAction}
          </p>
          <div className='space-y-3 rounded-xl bg-muted/25 p-3'>
            <strong className='text-sm'>Next safe action</strong>
            <CopyableCommand command={overview.nextCommand} label='Analytics command' />
          </div>
          {overview.error ? <p className='text-sm text-destructive'>{overview.error}</p> : null}
          {overview.reportWarning ? (
            <p className='text-sm text-destructive'>{overview.reportWarning}</p>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
