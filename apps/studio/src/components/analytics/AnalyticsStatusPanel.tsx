import { CliFallbackCommand } from "@/components/studio/CliFallbackCommand";
import { formatStudioInteger, MetricGrid } from "@/components/studio/MetricGrid";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { StudioAnalyticsOverview } from "@/lib/analyticsOverview";
import Link from "next/link";
import { AnalyticsReportActionPanel } from "./AnalyticsReportActionPanel";

type AnalyticsStatusPanelProps = Readonly<{ overview: StudioAnalyticsOverview }>;

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
          <p className='text-muted-foreground text-sm'>
            {overview.dataQuality.nextDataQualityAction}
          </p>
          <div className='bg-muted/25 space-y-3 rounded-xl p-3'>
            <strong className='text-sm'>Next safe action</strong>
            <AnalyticsReportActionPanel compact />
            <CliFallbackCommand
              align='start'
              command={overview.nextCommand}
              label='Analytics command'
              triggerLabel='Show analytics fallback'
            />
          </div>
          {overview.error ? <p className='text-destructive text-sm'>{overview.error}</p> : null}
          {overview.reportWarning ? (
            <p className='text-destructive text-sm'>{overview.reportWarning}</p>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
