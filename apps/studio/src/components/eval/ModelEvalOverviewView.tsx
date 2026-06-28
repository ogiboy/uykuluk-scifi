import { formatStudioInteger, MetricGrid } from "@/components/studio/MetricGrid";
import type {
  StudioCandidateEvalSummary,
  StudioModelEvalCheckSummary,
  StudioModelEvalOverview,
} from "@/lib/modelEvalOverview";

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
    <div className='analytics-detail-grid'>
      <section className='panel' aria-labelledby='model-eval-overview-heading'>
        <h2 id='model-eval-overview-heading'>Local Model Evaluation Overview</h2>
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
      </section>

      <section className='panel' aria-labelledby='model-eval-action-heading'>
        <h2 id='model-eval-action-heading'>Next Safe Action</h2>
        <code className='command'>{overview.nextCommand}</code>
        <p>
          Read-only display from local diagnostics artifacts. Studio does not call Ollama,
          llama.cpp, hosted APIs, edit config, create runs, approve stages, upload media, or publish
          content.
        </p>
        {overview.error ? <p className='blocked'>{overview.error}</p> : null}
      </section>

      <section className='panel' aria-labelledby='model-eval-single-checks-heading'>
        <h2 id='model-eval-single-checks-heading'>Single Model Check Results</h2>
        {overview.singleReport ? (
          <CheckList checks={overview.singleReport.checks} ownerId='single-model' />
        ) : (
          <p>No single-model check results are available.</p>
        )}
      </section>

      <CandidatePanel candidateReport={overview.candidateReport} />

      <section className='panel' aria-labelledby='model-eval-single-report-heading'>
        <h2 id='model-eval-single-report-heading'>Single Model Report Preview</h2>
        <p className='artifact-meta'>
          {overview.singleMarkdownPath}
          {overview.singleReportPreviewTruncated ? " · preview truncated" : ""}
        </p>
        {overview.singleReportPreview ? (
          <pre className='artifact-preview'>{overview.singleReportPreview}</pre>
        ) : (
          <p>Run the CLI local model evaluation command to generate a report artifact.</p>
        )}
      </section>

      <section className='panel' aria-labelledby='model-eval-candidate-report-heading'>
        <h2 id='model-eval-candidate-report-heading'>Candidate Report Preview</h2>
        <p className='artifact-meta'>
          {overview.candidateMarkdownPath}
          {overview.candidateReportPreviewTruncated ? " · preview truncated" : ""}
        </p>
        {overview.candidateReportPreview ? (
          <pre className='artifact-preview'>{overview.candidateReportPreview}</pre>
        ) : (
          <p>Run the CLI candidate evaluation command to generate a comparison artifact.</p>
        )}
      </section>
    </div>
  );
}

function CandidatePanel({
  candidateReport,
}: Readonly<{ candidateReport: StudioCandidateEvalSummary | null }>) {
  return (
    <section className='panel' aria-labelledby='model-eval-candidates-heading'>
      <h2 id='model-eval-candidates-heading'>Candidate Results</h2>
      {candidateReport ? (
        <>
          <p className='artifact-meta'>
            Recommended passing candidate:{" "}
            {candidateReport.recommendedCandidate?.configuredModel ?? "none yet"}
          </p>
          <ul className='artifact-preview-list'>
            {candidateReport.candidates.map((candidate, index) => (
              <li className='artifact-preview-card' key={`${candidate.configuredModel}-${index}`}>
                <div className='artifact-preview-header'>
                  <div>
                    <strong>{candidate.configuredModel}</strong>
                    <span>
                      {candidate.passCount} passed · {candidate.blockCount} blocked checks ·{" "}
                      {candidate.durationMs}ms
                    </span>
                  </div>
                  <span
                    className={candidate.passed ? "status-pill small" : "status-pill small blocked"}
                  >
                    {candidate.passed ? "pass" : "block"}
                  </span>
                </div>
                <CheckList checks={candidate.checks} ownerId={`candidate-${index}`} />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p>No candidate comparison report has been generated.</p>
      )}
    </section>
  );
}

function CheckList({
  checks,
  ownerId,
}: Readonly<{ checks: StudioModelEvalCheckSummary[]; ownerId: string }>) {
  return (
    <ul className='artifact-preview-list'>
      {checks.map((check) => (
        <li className='artifact-preview-card' key={`${ownerId}-${check.name}`}>
          <div className='artifact-preview-header'>
            <div>
              <strong>{check.name}</strong>
              <span>{check.message}</span>
            </div>
            <span
              className={
                check.status === "pass" ? "status-pill small" : "status-pill small blocked"
              }
            >
              {check.status}
            </span>
          </div>
          <p className='artifact-meta'>
            {check.durationMs === null ? "duration n/a" : `${check.durationMs}ms`}
            {" · "}
            input {check.inputTokensApprox ?? "n/a"} / output {check.outputTokensApprox ?? "n/a"}
            {check.promptHash ? ` · prompt ${check.promptHash}` : ""}
            {check.outputHash ? ` · output ${check.outputHash}` : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}
