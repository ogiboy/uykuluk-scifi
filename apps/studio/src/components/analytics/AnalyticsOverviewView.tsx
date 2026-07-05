import type { StudioAnalyticsOverview } from "@/lib/analyticsOverview";
import { CopyableCommand } from "@/components/studio/CopyableCommand";
import { formatStudioInteger, MetricGrid } from "@/components/studio/MetricGrid";
import { AnalyticsActionPanel } from "./AnalyticsActionPanel";

type AnalyticsOverviewViewProps = Readonly<{
  overview: StudioAnalyticsOverview;
}>;

/**
 * Renders a read-only analytics overview dashboard.
 *
 * @param overview - Analytics data used to populate the overview panels.
 * @returns The analytics overview layout.
 */
export function AnalyticsOverviewView({ overview }: AnalyticsOverviewViewProps) {
  return (
    <div className='analytics-detail-grid'>
      <section className='panel' aria-labelledby='analytics-overview-heading'>
        <h2 id='analytics-overview-heading'>Manual Analytics Overview</h2>
        <MetricGrid
          metrics={[
            { label: "Status", value: overview.status },
            { label: "Records", value: formatStudioInteger(overview.recordCount) },
            { label: "Mapped runs", value: formatStudioInteger(overview.mappedRunCount) },
            {
              label: "Unmapped records",
              value: formatStudioInteger(overview.unmappedRecordCount),
            },
            { label: "Views", value: formatStudioInteger(overview.totalViews) },
            { label: "Impressions", value: formatStudioInteger(overview.totalImpressions) },
            { label: "Source", value: overview.sourceFileName ?? "not imported" },
            { label: "Generated", value: overview.generatedAt ?? "not generated" },
          ]}
        />
      </section>

      <section className='panel' aria-labelledby='analytics-action-heading'>
        <h2 id='analytics-action-heading'>Next Safe Action</h2>
        <CopyableCommand command={overview.nextCommand} label='Analytics command' />
        <p>
          Read-only display from local operator-provided analytics artifacts. Studio does not call
          YouTube APIs, infer causality, upload media, publish content, or mutate workflow state.
        </p>
        {overview.error ? <p className='blocked'>{overview.error}</p> : null}
      </section>

      <AnalyticsActionPanel />

      <section className='panel' aria-labelledby='analytics-quality-heading'>
        <h2 id='analytics-quality-heading'>Import Data Quality</h2>
        <MetricGrid
          metrics={[
            {
              label: "High confidence",
              value: formatStudioInteger(overview.dataQuality.highConfidenceRecordCount),
            },
            {
              label: "Medium confidence",
              value: formatStudioInteger(overview.dataQuality.mediumConfidenceRecordCount),
            },
            {
              label: "Low confidence",
              value: formatStudioInteger(overview.dataQuality.lowConfidenceRecordCount),
            },
            {
              label: "Missing run links",
              value: formatStudioInteger(overview.dataQuality.missingRunLinkCount),
            },
            {
              label: "Missing CTR",
              value: formatStudioInteger(overview.dataQuality.missingCtrCount),
            },
            {
              label: "Missing retention",
              value: formatStudioInteger(overview.dataQuality.missingRetentionCount),
            },
          ]}
        />
        <p>{overview.dataQuality.nextDataQualityAction}</p>
      </section>

      <section className='panel' aria-labelledby='analytics-top-video-heading'>
        <h2 id='analytics-top-video-heading'>Top Videos By Imported Views</h2>
        {overview.topVideos.length > 0 ? (
          <ul className='artifact-preview-list'>
            {overview.topVideos.map((video) => (
              <li className='artifact-preview-card' key={video.videoId}>
                <div className='artifact-preview-header'>
                  <div>
                    <strong>{video.title}</strong>
                    <span>{video.videoId}</span>
                  </div>
                  <span className='status-pill small'>
                    {formatStudioInteger(video.views)} views
                  </span>
                </div>
                <p className='artifact-meta'>{video.runId ?? "unmapped run"}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p>No imported video records yet.</p>
        )}
      </section>

      <section className='panel' aria-labelledby='analytics-report-heading'>
        <h2 id='analytics-report-heading'>Report Preview</h2>
        <p className='artifact-meta'>
          {overview.reportPath} · report status: {overview.reportStatus}
          {overview.reportPreviewTruncated ? " · preview truncated" : ""}
        </p>
        <p className='artifact-meta'>Run link template: {overview.runLinkTemplatePath}</p>
        {overview.reportWarning ? <p className='blocked'>{overview.reportWarning}</p> : null}
        {overview.reportPreview ? (
          <pre className='artifact-preview'>{overview.reportPreview}</pre>
        ) : (
          <p>Run the CLI analytics report command to refresh the local report artifact.</p>
        )}
      </section>
    </div>
  );
}
