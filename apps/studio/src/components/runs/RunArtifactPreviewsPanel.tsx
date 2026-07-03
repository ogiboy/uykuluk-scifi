import type { StudioArtifactPreview } from "@/lib/artifactPreviews";
import { buildArtifactReviewHandoff } from "@/lib/artifactReviewHandoff";
import { artifactPreviewsIntro } from "@/lib/runEvidenceCopy";
import type { StudioRunDetail } from "@/lib/runSummaries";

type RunArtifactPreviewsPanelProps = Readonly<{
  artifacts: StudioRunDetail["artifacts"];
  evidenceStatus: StudioRunDetail["evidenceStatus"];
}>;

/**
 * Renders read-only artifact previews grouped by operator review phase.
 *
 * @param artifacts - The artifact preview metadata to display.
 * @param evidenceStatus - The current evidence status used for operator copy.
 */
export function RunArtifactPreviewsPanel({
  artifacts,
  evidenceStatus,
}: RunArtifactPreviewsPanelProps) {
  const artifactGroups = groupedArtifactPreviews(artifacts);
  const reviewHandoff = buildArtifactReviewHandoff(artifacts);

  return (
    <section className='panel' aria-labelledby='artifact-heading'>
      <h2 id='artifact-heading'>Artifact Previews</h2>
      <p>
        Read-only excerpts grouped by operator review phase. Use CLI commands to change workflow
        state.
      </p>
      <p>{artifactPreviewsIntro(evidenceStatus)}</p>
      <section className='artifact-review-handoff' aria-label='Artifact review handoff milestones'>
        <div className='artifact-review-handoff-heading'>
          <div>
            <h3>Review handoff path</h3>
            <p>
              {reviewHandoff.availableCount}/{reviewHandoff.totalCount} review milestones are
              available as local artifacts.
            </p>
          </div>
          {reviewHandoff.nextFocus ? (
            <span className='status-pill small pending'>next: {reviewHandoff.nextFocus.label}</span>
          ) : (
            <span className='status-pill small done'>all review docs available</span>
          )}
        </div>
        <ol className='artifact-review-milestones'>
          {reviewHandoff.milestones.map((milestone) => (
            <li key={milestone.path}>
              <span
                className={
                  milestone.available ? "status-pill small done" : "status-pill small pending"
                }
              >
                {milestone.available ? "available" : "pending"}
              </span>
              <strong>{milestone.label}</strong>
              <small>{milestone.path}</small>
            </li>
          ))}
        </ol>
      </section>
      <div className='artifact-preview-groups'>
        {artifactGroups.map((group, groupIndex) => (
          <details className='artifact-preview-group' key={group.label} open={groupIndex === 0}>
            <summary>
              <span>{group.label}</span>
              <small>{group.artifacts.length} artifact(s)</small>
            </summary>
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
                    {typeof artifact.sizeBytes === "number" ? ` · ${artifact.sizeBytes} bytes` : ""}
                    {artifact.previewTruncated ? " · preview truncated" : ""}
                  </p>
                  {artifact.preview ? (
                    <details className='artifact-preview-toggle'>
                      <summary>Preview excerpt</summary>
                      <pre className='artifact-preview'>{artifact.preview}</pre>
                    </details>
                  ) : (
                    <p>{artifactPreviewFallback(artifact)}</p>
                  )}
                  <p className='artifact-action'>{artifact.operatorAction}</p>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </section>
  );
}

/**
 * Groups artifact previews by group label.
 *
 * @param artifacts - The artifact previews to group.
 * @returns The grouped artifact previews, ordered by first occurrence of each group.
 */
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

/**
 * Provides a fallback message for an artifact preview.
 *
 * @param artifact - The artifact preview metadata
 * @returns A message explaining why the preview is unavailable
 */
function artifactPreviewFallback(artifact: StudioArtifactPreview): string {
  if (!artifact.exists) {
    return "Artifact is not generated yet.";
  }
  if (artifact.kind === "binary") {
    return "Binary or media artifact. Preview is intentionally limited to metadata.";
  }
  return "Text preview is unavailable; inspect the artifact from the CLI.";
}
