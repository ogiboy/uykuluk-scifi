import { studioCaptionArtifactUrl } from "@/lib/studioMediaArtifacts";
import type { ProductionMediaStatus } from "../../../../../src/stages/statusMediaSummary";

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
      <div className='production-media-preview'>
        <audio controls preload='metadata' src={mediaUrl}>
          <track default kind='captions' label='Türkçe altyazı' src={captionUrl} srcLang='tr' />
          <a href={mediaUrl}>Open voiceover audio</a>
        </audio>
        <ProductionMediaReviewLinks artifact={artifact} mediaUrl={mediaUrl} />
        <p>
          Browser playback is local review only; evidence and approval gates remain authoritative.
        </p>
      </div>
    );
  }
  if (artifact.evidenceKey === "draftRender") {
    return (
      <div className='production-media-preview'>
        <video controls preload='metadata' src={mediaUrl}>
          <track default kind='captions' label='Türkçe altyazı' src={captionUrl} srcLang='tr' />
          <a href={mediaUrl}>Open draft render video</a>
        </video>
        <ProductionMediaReviewLinks artifact={artifact} mediaUrl={mediaUrl} />
        <p>Playback does not approve upload, schedule, public publish, or final channel handoff.</p>
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
    <div className='production-media-actions' aria-label={`${artifact.label} local media actions`}>
      <a href={mediaUrl} target='_blank' rel='noreferrer'>
        Open in browser
      </a>
      <a href={mediaUrl} download={mediaDownloadName(artifact.artifactPath)}>
        Download review copy
      </a>
    </div>
  );
}

function mediaDownloadName(artifactPath: string): string {
  return artifactPath.split("/").at(-1) ?? "review-media";
}
