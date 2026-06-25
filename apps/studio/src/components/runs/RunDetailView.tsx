import type { StudioRunDetail } from "@/lib/runSummaries";

export function RunDetailView({ run }: Readonly<{ run: StudioRunDetail }>) {
  return (
    <div className='run-detail-grid'>
      <section className='panel' aria-labelledby='run-overview-heading'>
        <h2 id='run-overview-heading'>Run Overview</h2>
        <dl className='run-metadata'>
          <div>
            <dt>State</dt>
            <dd>{run.state}</dd>
          </div>
          <div>
            <dt>Approvals</dt>
            <dd>{run.approvalCount}</dd>
          </div>
          <div>
            <dt>Warnings</dt>
            <dd>{run.warningCount}</dd>
          </div>
          <div>
            <dt>Readiness</dt>
            <dd>{formatReadiness(run.readinessPassed)}</dd>
          </div>
        </dl>
      </section>

      <section className='panel' aria-labelledby='next-action-heading'>
        <h2 id='next-action-heading'>Next Safe Action</h2>
        <code className='command'>
          {run.nextRecommendedCommand ?? "Run pnpm producer evidence --run <run_id>"}
        </code>
        <p>
          Read-only display. Use the CLI to mutate approvals, artifacts, render, upload, or publish
          state.
        </p>
      </section>

      <section className='panel' aria-labelledby='artifact-heading'>
        <h2 id='artifact-heading'>Artifact Previews</h2>
        <p>Read-only excerpts from review artifacts. Use CLI commands to change workflow state.</p>
        <ul className='artifact-preview-list'>
          {run.artifacts.map((artifact) => (
            <li className='artifact-preview-card' key={artifact.path}>
              <div className='artifact-preview-header'>
                <div>
                  <strong>{artifact.label}</strong>
                  <span>{artifact.path}</span>
                </div>
                <span
                  className={artifact.exists ? "status-pill small" : "status-pill small blocked"}
                >
                  {artifact.exists ? "available" : "missing"}
                </span>
              </div>
              <p className='artifact-meta'>
                {artifact.kind}
                {typeof artifact.sizeBytes === "number" ? ` · ${artifact.sizeBytes} bytes` : ""}
                {artifact.previewTruncated ? " · preview truncated" : ""}
              </p>
              {artifact.preview ? (
                <pre className='artifact-preview'>{artifact.preview}</pre>
              ) : (
                <p>{artifactPreviewFallback(artifact.exists)}</p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className='panel' aria-labelledby='readiness-heading'>
        <h2 id='readiness-heading'>Readiness Checks</h2>
        <p>
          {run.readiness?.passed === true ? "Readiness passed." : "Readiness has not passed yet."}
        </p>
        <p>
          {Array.isArray(run.readiness?.checks)
            ? `${run.readiness.checks.length} check(s) recorded.`
            : "No readiness checks recorded."}
        </p>
      </section>
    </div>
  );
}

function formatReadiness(value: boolean | null): string {
  if (value === true) {
    return "passed";
  }
  if (value === false) {
    return "blocked";
  }
  return "not generated";
}

function artifactPreviewFallback(exists: boolean): string {
  if (exists) {
    return "Binary or media artifact. Preview is intentionally limited to metadata.";
  }
  return "Artifact is not generated yet.";
}
