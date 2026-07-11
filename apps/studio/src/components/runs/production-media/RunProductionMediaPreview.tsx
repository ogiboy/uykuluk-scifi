import type { ProductionMediaStatus } from "@/lib/runEvidenceCopy";
import { studioCaptionArtifactUrl } from "@/lib/studioMediaArtifacts";

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
      <div className='bg-muted/10 grid gap-3 rounded-lg p-3'>
        <audio className='w-full' controls preload='metadata' src={mediaUrl}>
          <track default kind='captions' label='Türkçe altyazı' src={captionUrl} srcLang='tr' />
          <a href={mediaUrl}>Open voiceover audio</a>
        </audio>
        <ProductionMediaReviewLinks artifact={artifact} mediaUrl={mediaUrl} />
        <p className='text-muted-foreground text-sm'>
          Browser playback is local review only; evidence and approval gates remain authoritative.
        </p>
      </div>
    );
  }
  if (artifact.evidenceKey === "draftRender") {
    return (
      <div className='bg-muted/10 grid gap-3 rounded-lg p-3'>
        <video
          className='bg-background w-full rounded-md'
          controls
          preload='metadata'
          src={mediaUrl}
        >
          <track default kind='captions' label='Türkçe altyazı' src={captionUrl} srcLang='tr' />
          <a href={mediaUrl}>Open draft render video</a>
        </video>
        <ProductionMediaReviewLinks artifact={artifact} mediaUrl={mediaUrl} />
        <p className='text-muted-foreground text-sm'>
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
        className='bg-muted/20 hover:bg-accent hover:text-accent-foreground rounded-md px-3 py-1.5 text-sm font-medium'
        href={mediaUrl}
        target='_blank'
        rel='noreferrer'
      >
        Open in browser
      </a>
      <a
        className='bg-muted/20 hover:bg-accent hover:text-accent-foreground rounded-md px-3 py-1.5 text-sm font-medium'
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
