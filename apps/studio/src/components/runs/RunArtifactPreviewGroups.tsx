import type { StudioArtifactPreview } from "@/lib/artifactPreviews";
import { cn } from "@/lib/utils";
import { Badge } from "../ui/badge";

type ArtifactPreviewGroup = Readonly<{ artifacts: StudioArtifactPreview[]; label: string }>;

type RunArtifactPreviewGroupsProps = Readonly<{ artifactGroups: ArtifactPreviewGroup[] }>;

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
          className='bg-background/35 rounded-lg p-4'
          key={group.label}
          open={groupIndex === 0}
        >
          <summary className='flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold'>
            <span>{group.label}</span>
            <small className='text-muted-foreground text-xs font-normal'>
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
    <li className='bg-muted/10 grid gap-3 rounded-lg p-4'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div className='min-w-0'>
          <strong className='block text-sm'>{artifact.label}</strong>
          <span className='text-muted-foreground block font-mono text-xs break-all'>
            {artifact.path}
          </span>
        </div>
        <Badge
          className={cn(
            "capitalize",
            !artifact.exists &&
              "bg-amber-500/10 text-amber-800 ring-amber-500/20 dark:text-amber-200",
          )}
          variant={artifact.exists ? "secondary" : "outline"}
        >
          {artifact.exists ? "available" : "missing"}
        </Badge>
      </div>
      <p className='text-muted-foreground text-sm'>{artifact.description}</p>
      <p className='text-muted-foreground text-xs'>
        {artifact.kind}
        {typeof artifact.sizeBytes === "number" ? ` · ${artifact.sizeBytes} bytes` : ""}
        {artifact.previewTruncated ? " · preview truncated" : ""}
      </p>
      {artifact.preview ? (
        <details className='bg-background/45 grid gap-2 rounded-lg p-3'>
          <summary className='cursor-pointer text-sm font-medium'>Preview excerpt</summary>
          <pre className='bg-muted/10 max-h-56 overflow-auto rounded-md p-3 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap'>
            {artifact.preview}
          </pre>
        </details>
      ) : (
        <p className='text-muted-foreground text-sm'>{artifactPreviewFallback(artifact)}</p>
      )}
      <p className='rounded-lg bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100'>
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
