import { studioCaptionArtifactUrl } from "@/lib/studioMediaArtifacts";
import type { ProductionMediaStatus } from "@/lib/runEvidenceCopy";

type RunProductionMediaPreviewProps = Readonly<{
  artifact: ProductionMediaStatus;
  mediaUrl: string;
  runId: string;
}>;

export function RunProductionMediaPreview({
  artifact,
  mediaUrl,
  runId,
}: RunProductionMediaPreviewProps) {
  const captionUrl = studioCaptionArtifactUrl(runId);
  if (artifact.evidenceKey === "voiceoverAudio") {
    return (
      <div className='grid gap-3 rounded-lg bg-muted/10 p-3'>
        <audio className='w-full' controls preload='metadata' src={mediaUrl}>
          <track default kind='captions' label='Türkçe altyazı' src={captionUrl} srcLang='tr' />
          <a href={mediaUrl}>Open voiceover audio</a>
        </audio>
        <ProductionMediaReviewLinks artifact={artifact} mediaUrl={mediaUrl} />
        <p className='text-sm text-muted-foreground'>
          Browser playback is local review only; evidence and approval gates remain authoritative.
        </p>
      </div>
    );
  }
  if (artifact.evidenceKey === "draftRender") {
    return (
      <div className='grid gap-3 rounded-lg bg-muted/10 p-3'>
        <video
          className='w-full rounded-md bg-background'
          controls
          preload='metadata'
          src={mediaUrl}
        >
          <track default kind='captions' label='Türkçe altyazı' src={captionUrl} srcLang='tr' />
          <a href={mediaUrl}>Open draft render video</a>
        </video>
        <ProductionMediaReviewLinks artifact={artifact} mediaUrl={mediaUrl} />
        <p className='text-sm text-muted-foreground'>
          Playback does not approve upload, schedule, public publish, or final channel handoff.
        </p>
      </div>
    );
  }
  return null;
}

function ProductionMediaReviewLinks({
  artifact,
  mediaUrl,
}: Readonly<{ artifact: ProductionMediaStatus; mediaUrl: string }>) {
  return (
    <div className='flex flex-wrap gap-2' aria-label={`${artifact.label} local media actions`}>
      <a
        className='rounded-md bg-muted/20 px-3 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground'
        href={mediaUrl}
        target='_blank'
        rel='noreferrer'
      >
        Open in browser
      </a>
      <a
        className='rounded-md bg-muted/20 px-3 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground'
        href={mediaUrl}
        download={mediaDownloadName(artifact.artifactPath)}
      >
        Download review copy
      </a>
    </div>
  );
}

function mediaDownloadName(artifactPath: string): string {
  return artifactPath.split("/").at(-1) ?? "review-media";
}
