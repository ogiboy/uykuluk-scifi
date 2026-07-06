import { formatStudioInteger, MetricGrid } from "@/components/studio/MetricGrid";
import { ArtifactPreview } from "@/components/studio/ArtifactPreview";
import { CliFallbackCommand } from "@/components/studio/CliFallbackCommand";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { StudioModelEvalOverview } from "@/lib/modelEvalOverview";
import { ModelEvalCandidatePanel, ModelEvalCheckList } from "./ModelEvalCandidatePanel";

type ModelEvalOverviewViewProps = Readonly<{
  overview: StudioModelEvalOverview;
}>;

/**
 * Renders the read-only local model evaluation overview.
 *
 * @param overview - Model evaluation data loaded from ignored diagnostics artifacts.
 * @returns The model evaluation overview layout.
 */
export function ModelEvalOverviewView({ overview }: ModelEvalOverviewViewProps) {
  return (
    <div className='grid gap-4 lg:grid-cols-2'>
      <section aria-labelledby='model-eval-overview-heading'>
        <Card>
          <CardHeader>
            <h2 className='text-xl font-semibold tracking-tight' id='model-eval-overview-heading'>
              Local Model Evaluation Overview
            </h2>
          </CardHeader>
          <CardContent>
            <MetricGrid
              metrics={[
                { label: "Status", value: overview.status },
                {
                  label: "Single model",
                  value: overview.singleReport?.configuredModel ?? "not evaluated",
                },
                {
                  label: "Single checks passed",
                  value: overview.singleReport
                    ? `${overview.singleReport.passCount}/${overview.singleReport.checkCount}`
                    : "n/a",
                },
                {
                  label: "Candidates",
                  value: formatStudioInteger(overview.candidateReport?.candidateCount ?? 0),
                },
                {
                  label: "Passing candidates",
                  value: formatStudioInteger(overview.candidateReport?.passingCandidateCount ?? 0),
                },
                {
                  label: "Blocked candidates",
                  value: formatStudioInteger(overview.candidateReport?.blockedCandidateCount ?? 0),
                },
                {
                  label: "Recommended candidate",
                  value: overview.candidateReport?.recommendedCandidate?.configuredModel ?? "none",
                },
              ]}
            />
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby='model-eval-action-heading'>
        <Card>
          <CardHeader>
            <h2 className='text-xl font-semibold tracking-tight' id='model-eval-action-heading'>
              Next Safe Action
            </h2>
          </CardHeader>
          <CardContent className='space-y-4'>
            <CliFallbackCommand
              align='start'
              command={overview.nextCommand}
              label='Model eval command'
              triggerLabel='Show eval fallback'
            />
            <p className='text-sm text-muted-foreground'>
              Read-only display from local diagnostics artifacts. Studio does not call Ollama,
              llama.cpp, hosted APIs, edit config, create runs, approve stages, upload media, or
              publish content.
            </p>
            {overview.error ? <p className='text-sm text-destructive'>{overview.error}</p> : null}
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby='model-eval-single-checks-heading'>
        <Card>
          <CardHeader>
            <h2
              className='text-xl font-semibold tracking-tight'
              id='model-eval-single-checks-heading'
            >
              Single Model Check Results
            </h2>
          </CardHeader>
          <CardContent>
            {overview.singleReport ? (
              <ModelEvalCheckList checks={overview.singleReport.checks} ownerId='single-model' />
            ) : (
              <p className='text-sm text-muted-foreground'>
                No single-model check results are available.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <ModelEvalCandidatePanel candidateReport={overview.candidateReport} />

      <section aria-labelledby='model-eval-single-report-heading'>
        <Card>
          <CardHeader>
            <h2
              className='text-xl font-semibold tracking-tight'
              id='model-eval-single-report-heading'
            >
              Single Model Report Preview
            </h2>
          </CardHeader>
          <CardContent className='space-y-3'>
            <p className='text-xs text-muted-foreground'>
              {overview.singleMarkdownPath}
              {overview.singleReportPreviewTruncated ? " · preview truncated" : ""}
            </p>
            {overview.singleReportPreview ? (
              <ArtifactPreview>{overview.singleReportPreview}</ArtifactPreview>
            ) : (
              <p className='text-sm text-muted-foreground'>
                Run the CLI local model evaluation command to generate a report artifact.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby='model-eval-candidate-report-heading'>
        <Card>
          <CardHeader>
            <h2
              className='text-xl font-semibold tracking-tight'
              id='model-eval-candidate-report-heading'
            >
              Candidate Report Preview
            </h2>
          </CardHeader>
          <CardContent className='space-y-3'>
            <p className='text-xs text-muted-foreground'>
              {overview.candidateMarkdownPath}
              {overview.candidateReportPreviewTruncated ? " · preview truncated" : ""}
            </p>
            {overview.candidateReportPreview ? (
              <ArtifactPreview>{overview.candidateReportPreview}</ArtifactPreview>
            ) : (
              <p className='text-sm text-muted-foreground'>
                Run the CLI candidate evaluation command to generate a comparison artifact.
              </p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
