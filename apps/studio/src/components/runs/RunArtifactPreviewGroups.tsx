import type { StudioArtifactPreview } from "@/lib/artifactPreviews";

type ArtifactPreviewGroup = Readonly<{
  artifacts: StudioArtifactPreview[];
  label: string;
}>;

type RunArtifactPreviewGroupsProps = Readonly<{
  artifactGroups: ArtifactPreviewGroup[];
}>;

export function RunArtifactPreviewGroups({ artifactGroups }: RunArtifactPreviewGroupsProps) {
  return (
    <div className='artifact-preview-groups'>
      {artifactGroups.map((group, groupIndex) => (
        <details className='artifact-preview-group' key={group.label} open={groupIndex === 0}>
          <summary>
            <span>{group.label}</span>
            <small>{group.artifacts.length} artifact(s)</small>
          </summary>
          <ul className='artifact-preview-list'>
            {group.artifacts.map((artifact) => (
              <ArtifactPreviewCard artifact={artifact} key={artifact.path} />
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}

function ArtifactPreviewCard({ artifact }: Readonly<{ artifact: StudioArtifactPreview }>) {
  return (
    <li className='artifact-preview-card'>
      <div className='artifact-preview-header'>
        <div>
          <strong>{artifact.label}</strong>
          <span>{artifact.path}</span>
        </div>
        <span className={artifact.exists ? "status-pill small" : "status-pill small blocked"}>
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
  );
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
