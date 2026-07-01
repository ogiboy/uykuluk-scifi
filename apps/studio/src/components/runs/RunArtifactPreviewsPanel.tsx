import type { StudioArtifactPreview } from "@/lib/artifactPreviews";
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

  return (
    <section className='panel' aria-labelledby='artifact-heading'>
      <h2 id='artifact-heading'>Artifact Previews</h2>
      <p>
        Read-only excerpts grouped by operator review phase. Use CLI commands to change workflow
        state.
      </p>
      <p>{artifactPreviewsIntro(evidenceStatus)}</p>
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
                    {typeof artifact.sizeBytes === "number" ? ` · ${artifact.sizeBytes} bytes` : ""}
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
