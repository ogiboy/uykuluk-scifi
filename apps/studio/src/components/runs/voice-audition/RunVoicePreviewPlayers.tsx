import { Badge } from "@/components/ui/badge";
import type {
  StudioVoiceCandidateSummary,
  StudioVoicePreviewSummary,
} from "@/lib/runs/voiceAuditionSummaries";

export function VoiceComparison({
  candidates,
  runId,
}: Readonly<{ candidates: readonly StudioVoiceCandidateSummary[]; runId: string }>) {
  return (
    <section
      className='bg-muted/10 ring-border/5 grid gap-3 rounded-lg p-4 ring-1'
      aria-labelledby='voice-comparison-heading'
    >
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div>
          <h3 className='text-sm font-semibold' id='voice-comparison-heading'>
            A/B local preview
          </h3>
          <p className='text-muted-foreground mt-1 text-sm'>
            Select up to two persisted previews. Playback never uses a provider URL.
          </p>
        </div>
        <Badge variant='outline'>{candidates.length}/2 selected</Badge>
      </div>
      {candidates.length > 0 ? (
        <div className='grid gap-3 md:grid-cols-2'>
          {candidates.map((candidate, index) => (
            <div className='bg-background/45 grid gap-2 rounded-lg p-3' key={candidate.voiceId}>
              <div className='flex items-center justify-between gap-2'>
                <strong>
                  {index === 0 ? "A" : "B"} · {candidate.name}
                </strong>
                <Badge variant='outline'>{candidate.turkishSuitability} Turkish</Badge>
              </div>
              <LocalPreviewPlayer preview={candidate.preview} runId={runId} />
            </div>
          ))}
        </div>
      ) : (
        <p className='text-muted-foreground text-sm'>
          Add a voice to comparison from the candidate list.
        </p>
      )}
    </section>
  );
}

export function LocalPreviewPlayer({
  preview,
  runId,
}: Readonly<{ preview: StudioVoicePreviewSummary; runId: string }>) {
  const mediaUrl = localMediaUrl(runId, preview.mediaUrl);
  return mediaUrl ? (
    <audio className='w-full' controls preload='none' src={mediaUrl}>
      Your browser does not support local audio preview.
    </audio>
  ) : (
    <p className='bg-background/40 text-muted-foreground rounded-md p-2 text-xs'>
      {preview.message}
    </p>
  );
}

function localMediaUrl(runId: string, value: string | null): string | null {
  if (!value) return null;
  const prefix = `/runs/${encodeURIComponent(runId)}/media/production/audio/voice-previews/`;
  return value.startsWith(prefix) ? value : null;
}
