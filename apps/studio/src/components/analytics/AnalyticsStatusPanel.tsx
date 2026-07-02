import Link from "next/link";
import type { StudioAnalyticsOverview } from "@/lib/analyticsOverview";
import { formatStudioInteger, MetricGrid } from "@/components/studio/MetricGrid";
import { CopyableCommand } from "@/components/studio/CopyableCommand";

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
    <section className='panel' aria-labelledby='analytics-status-heading'>
      <div className='artifact-preview-header'>
        <div>
          <h2 id='analytics-status-heading'>Analytics Feedback</h2>
          <p className='artifact-description'>
            Manual import only. Studio reads local artifacts and does not call YouTube APIs.
          </p>
        </div>
        <Link className='status-pill small' href='/analytics'>
          Open analytics
        </Link>
      </div>
      <MetricGrid
        metrics={[
          { label: "Status", value: overview.status },
          { label: "Records", value: formatStudioInteger(overview.recordCount) },
          { label: "Mapped runs", value: formatStudioInteger(overview.mappedRunCount) },
          { label: "Report", value: overview.reportStatus },
        ]}
      />
      <p>{overview.dataQuality.nextDataQualityAction}</p>
      <div className='artifact-action'>
        <strong>Next safe action</strong>
        <CopyableCommand command={overview.nextCommand} label='Analytics command' />
      </div>
      {overview.error ? <p className='blocked'>{overview.error}</p> : null}
      {overview.reportWarning ? <p className='blocked'>{overview.reportWarning}</p> : null}
    </section>
  );
}
