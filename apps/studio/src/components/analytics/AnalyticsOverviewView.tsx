import type { StudioAnalyticsOverview } from "@/lib/analyticsOverview";

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
        <dl className='run-metadata'>
          <Metric label='Status' value={overview.status} />
          <Metric label='Records' value={formatInteger(overview.recordCount)} />
          <Metric label='Mapped runs' value={formatInteger(overview.mappedRunCount)} />
          <Metric label='Unmapped records' value={formatInteger(overview.unmappedRecordCount)} />
          <Metric label='Views' value={formatInteger(overview.totalViews)} />
          <Metric label='Impressions' value={formatInteger(overview.totalImpressions)} />
          <Metric label='Source' value={overview.sourceFileName ?? "not imported"} />
          <Metric label='Generated' value={overview.generatedAt ?? "not generated"} />
        </dl>
      </section>

      <section className='panel' aria-labelledby='analytics-action-heading'>
        <h2 id='analytics-action-heading'>Next Safe Action</h2>
        <code className='command'>{overview.nextCommand}</code>
        <p>
          Read-only display from local operator-provided analytics artifacts. Studio does not call
          YouTube APIs, infer causality, upload media, publish content, or mutate workflow state.
        </p>
        {overview.error ? <p className='blocked'>{overview.error}</p> : null}
      </section>

      <section className='panel' aria-labelledby='analytics-quality-heading'>
        <h2 id='analytics-quality-heading'>Import Data Quality</h2>
        <dl className='run-metadata'>
          <Metric
            label='High confidence'
            value={formatInteger(overview.dataQuality.highConfidenceRecordCount)}
          />
          <Metric
            label='Medium confidence'
            value={formatInteger(overview.dataQuality.mediumConfidenceRecordCount)}
          />
          <Metric
            label='Low confidence'
            value={formatInteger(overview.dataQuality.lowConfidenceRecordCount)}
          />
          <Metric
            label='Missing run links'
            value={formatInteger(overview.dataQuality.missingRunLinkCount)}
          />
          <Metric label='Missing CTR' value={formatInteger(overview.dataQuality.missingCtrCount)} />
          <Metric
            label='Missing retention'
            value={formatInteger(overview.dataQuality.missingRetentionCount)}
          />
        </dl>
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
                  <span className='status-pill small'>{formatInteger(video.views)} views</span>
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

/**
 * Displays a label and value pair.
 *
 * @param label - The term to show.
 * @param value - The value to show.
 */
function Metric({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/**
 * Formats a number as a rounded US locale integer.
 *
 * @param value - The number to format.
 * @returns The rounded number formatted with US digit separators.
 */
function formatInteger(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}
