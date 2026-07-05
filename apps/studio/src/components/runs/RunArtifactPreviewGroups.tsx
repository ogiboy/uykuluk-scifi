import type { StudioArtifactPreview } from "@/lib/artifactPreviews";
import { cn } from "@/lib/utils";
import { Badge } from "../ui/badge";

type ArtifactPreviewGroup = Readonly<{
  artifacts: StudioArtifactPreview[];
  label: string;
}>;

type RunArtifactPreviewGroupsProps = Readonly<{
  artifactGroups: ArtifactPreviewGroup[];
}>;

/**
 * Renders grouped local artifact previews for run review.
 *
 * @param artifactGroups - Artifact previews grouped by operator review phase.
 */
export function RunArtifactPreviewGroups({ artifactGroups }: RunArtifactPreviewGroupsProps) {
  return (
    <div className='grid gap-4'>
      {artifactGroups.map((group, groupIndex) => (
        <details
          className='rounded-lg border bg-background p-4'
          key={group.label}
          open={groupIndex === 0}
        >
          <summary className='flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold'>
            <span>{group.label}</span>
            <small className='text-xs font-normal text-muted-foreground'>
              {group.artifacts.length} artifact(s)
            </small>
          </summary>
          <ul className='mt-3 grid gap-3'>
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
    <li className='grid gap-3 rounded-lg border bg-muted/20 p-4'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div className='min-w-0'>
          <strong className='block text-sm'>{artifact.label}</strong>
          <span className='block break-all font-mono text-xs text-muted-foreground'>
            {artifact.path}
          </span>
        </div>
        <Badge
          className={cn(
            "capitalize",
            !artifact.exists &&
              "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
          )}
          variant={artifact.exists ? "secondary" : "outline"}
        >
          {artifact.exists ? "available" : "missing"}
        </Badge>
      </div>
      <p className='text-sm text-muted-foreground'>{artifact.description}</p>
      <p className='text-xs text-muted-foreground'>
        {artifact.kind}
        {typeof artifact.sizeBytes === "number" ? ` · ${artifact.sizeBytes} bytes` : ""}
        {artifact.previewTruncated ? " · preview truncated" : ""}
      </p>
      {artifact.preview ? (
        <details className='grid gap-2 rounded-lg border bg-background p-3'>
          <summary className='cursor-pointer text-sm font-medium'>Preview excerpt</summary>
          <pre className='max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted/20 p-3 font-mono text-xs leading-relaxed'>
            {artifact.preview}
          </pre>
        </details>
      ) : (
        <p className='text-sm text-muted-foreground'>{artifactPreviewFallback(artifact)}</p>
      )}
      <p className='rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100'>
        {artifact.operatorAction}
      </p>
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
