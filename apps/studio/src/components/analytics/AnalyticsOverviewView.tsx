import type { StudioAnalyticsOverview } from "@/lib/analyticsOverview";
import { ArtifactPreview } from "@/components/studio/ArtifactPreview";
import { CliFallbackCommand } from "@/components/studio/CliFallbackCommand";
import { formatStudioInteger, MetricGrid } from "@/components/studio/MetricGrid";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AnalyticsActionPanel } from "./AnalyticsActionPanel";
import { AnalyticsReportActionPanel } from "./AnalyticsReportActionPanel";

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
    <div className='grid gap-4 lg:grid-cols-2'>
      <section aria-labelledby='analytics-overview-heading'>
        <Card>
          <CardHeader>
            <h2 className='text-xl font-semibold tracking-tight' id='analytics-overview-heading'>
              Manual Analytics Overview
            </h2>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby='analytics-action-heading'>
        <Card>
          <CardHeader>
            <h2 className='text-xl font-semibold tracking-tight' id='analytics-action-heading'>
              Next Safe Action
            </h2>
          </CardHeader>
          <CardContent className='space-y-4'>
            <AnalyticsReportActionPanel compact />
            <CliFallbackCommand
              align='start'
              command={overview.nextCommand}
              label='Analytics command'
              triggerLabel='Show analytics fallback'
            />
            <p className='text-sm text-muted-foreground'>
              Read-only display from local operator-provided analytics artifacts. Studio does not
              call YouTube APIs, infer causality, upload media, publish content, or mutate workflow
              state.
            </p>
            {overview.error ? <p className='text-sm text-destructive'>{overview.error}</p> : null}
          </CardContent>
        </Card>
      </section>

      <AnalyticsActionPanel />

      <section aria-labelledby='analytics-quality-heading'>
        <Card>
          <CardHeader>
            <h2 className='text-xl font-semibold tracking-tight' id='analytics-quality-heading'>
              Import Data Quality
            </h2>
          </CardHeader>
          <CardContent className='space-y-4'>
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
            <p className='text-sm text-muted-foreground'>
              {overview.dataQuality.nextDataQualityAction}
            </p>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby='analytics-top-video-heading'>
        <Card>
          <CardHeader>
            <h2 className='text-xl font-semibold tracking-tight' id='analytics-top-video-heading'>
              Top Videos By Imported Views
            </h2>
          </CardHeader>
          <CardContent>
            {overview.topVideos.length > 0 ? (
              <ul className='grid gap-3'>
                {overview.topVideos.map((video) => (
                  <li className='grid gap-3 rounded-xl bg-muted/25 p-3' key={video.videoId}>
                    <div className='grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start'>
                      <div className='min-w-0 space-y-1'>
                        <strong>{video.title}</strong>
                        <span className='block text-sm text-muted-foreground'>{video.videoId}</span>
                      </div>
                      <Badge variant='secondary'>{formatStudioInteger(video.views)} views</Badge>
                    </div>
                    <p className='text-xs text-muted-foreground'>{video.runId ?? "unmapped run"}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className='text-sm text-muted-foreground'>No imported video records yet.</p>
            )}
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby='analytics-report-heading'>
        <Card>
          <CardHeader>
            <h2 className='text-xl font-semibold tracking-tight' id='analytics-report-heading'>
              Report Preview
            </h2>
          </CardHeader>
          <CardContent className='space-y-3'>
            <p className='text-xs text-muted-foreground'>
              {overview.reportPath} · report status: {overview.reportStatus}
              {overview.reportPreviewTruncated ? " · preview truncated" : ""}
            </p>
            <p className='text-xs text-muted-foreground'>
              Run link template: {overview.runLinkTemplatePath}
            </p>
            {overview.reportWarning ? (
              <p className='text-sm text-destructive'>{overview.reportWarning}</p>
            ) : null}
            {overview.reportPreview ? (
              <ArtifactPreview>{overview.reportPreview}</ArtifactPreview>
            ) : (
              <p className='text-sm text-muted-foreground'>
                Run the CLI analytics report command to refresh the local report artifact.
              </p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
