import type { StudioRunDetail } from "@/lib/runSummaries";
import type { StudioArtifactPreview } from "@/lib/artifactPreviews";

export function RunDetailView({ run }: Readonly<{ run: StudioRunDetail }>) {
  const artifactGroups = groupedArtifactPreviews(run.artifacts);

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

      <section className='panel' aria-labelledby='diagnostics-heading'>
        <h2 id='diagnostics-heading'>Diagnostics</h2>
        {run.diagnostics.length > 0 ? (
          <ul>
            {run.diagnostics.map((diagnostic) => (
              <li key={diagnostic.path}>
                <strong>{diagnostic.stage}</strong>: {diagnostic.message}
                <br />
                <span>{diagnostic.path}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>No run diagnostics recorded.</p>
        )}
      </section>

      <section className='panel' aria-labelledby='production-media-heading'>
        <h2 id='production-media-heading'>Production Media Evidence</h2>
        <p>
          Read-only summary from the CLI evidence bundle. Missing or blocked media remains a CLI
          workflow issue; Studio does not approve, render, upload, or publish.
        </p>
        <ul>
          {run.productionMedia.map((artifact) => (
            <li key={artifact.artifactPath}>
              <strong>{artifact.label}</strong>:{" "}
              <span className={mediaStatusClassName(artifact.status)}>{artifact.status}</span>
              {artifact.detail ? ` — ${artifact.detail}` : ""}
              <br />
              <span>{artifact.artifactPath}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className='panel' aria-labelledby='artifact-heading'>
        <h2 id='artifact-heading'>Artifact Previews</h2>
        <p>
          Read-only excerpts grouped by operator review phase. Use CLI commands to change workflow
          state.
        </p>
        <div className='artifact-preview-groups'>
          {artifactGroups.map((group) => (
            <section className='artifact-preview-group' key={group.label}>
              <h3>{group.label}</h3>
              <ul className='artifact-preview-list'>
                {group.artifacts.map((artifact) => (
                  <li className='artifact-preview-card' key={artifact.path}>
                    <div className='artifact-preview-header'>
                      <div>
                        <strong>{artifact.label}</strong>
                        <span>{artifact.path}</span>
                      </div>
                      <span
                        className={
                          artifact.exists ? "status-pill small" : "status-pill small blocked"
                        }
                      >
                        {artifact.exists ? "available" : "missing"}
                      </span>
                    </div>
                    <p className='artifact-description'>{artifact.description}</p>
                    <p className='artifact-meta'>
                      {artifact.kind}
                      {typeof artifact.sizeBytes === "number"
                        ? ` · ${artifact.sizeBytes} bytes`
                        : ""}
                      {artifact.previewTruncated ? " · preview truncated" : ""}
                    </p>
                    {artifact.preview ? (
                      <pre className='artifact-preview'>{artifact.preview}</pre>
                    ) : (
                      <p>{artifactPreviewFallback(artifact)}</p>
                    )}
                    <p className='artifact-action'>{artifact.operatorAction}</p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>

      <section className='panel' aria-labelledby='readiness-heading'>
        <h2 id='readiness-heading'>Readiness Checks</h2>
        <p>
          {run.readiness?.passed === true ? "Readiness passed." : "Readiness has not passed yet."}
        </p>
        <p>
          {run.readinessChecks.length > 0
            ? `${run.readinessChecks.length} check(s) recorded.`
            : "No readiness checks recorded."}
        </p>
        {run.readinessChecks.length > 0 ? (
          <ul>
            {run.readinessChecks.map((check) => (
              <li key={check.name}>
                <strong>{check.name}</strong>:{" "}
                <span className={readinessStatusClassName(check.status)}>{check.status}</span>
                <br />
                <span>{check.message}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}

function groupedArtifactPreviews(
  artifacts: StudioArtifactPreview[],
): Array<{ artifacts: StudioArtifactPreview[]; label: string }> {
  const groups = new Map<string, StudioArtifactPreview[]>();
  for (const artifact of artifacts) {
    groups.set(artifact.group, [...(groups.get(artifact.group) ?? []), artifact]);
  }
  return [...groups.entries()].map(([label, groupedArtifacts]) => ({
    artifacts: groupedArtifacts,
    label,
  }));
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

function mediaStatusClassName(status: string): string {
  return status === "pass" ? "status-pill small" : "status-pill small blocked";
}

function readinessStatusClassName(status: string): string {
  return status === "pass" ? "status-pill small" : "status-pill small blocked";
}

function artifactPreviewFallback(artifact: StudioArtifactPreview): string {
  if (!artifact.exists) {
    return "Artifact is not generated yet.";
  }
  if (artifact.kind === "binary") {
    return "Binary or media artifact. Preview is intentionally limited to metadata.";
  }
  return "Text preview is unavailable; inspect the artifact from the CLI.";
}
