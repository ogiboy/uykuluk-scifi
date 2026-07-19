import type { StudioLocalModelOverview } from "@/lib/localModels/localModelOverview";
import type { LocalModelCopy } from "./localModelReadinessCopy";

export function LocalModelProgress({
  copy,
  progress,
}: Readonly<{ copy: LocalModelCopy; progress: StudioLocalModelOverview["progress"] }>) {
  const total = progress?.totalBytes;
  const completed = progress?.completedBytes;
  const percent =
    typeof total === "number" && typeof completed === "number" && total > 0
      ? Math.min(100, Math.round((completed / total) * 100))
      : null;
  const hasMeasuredProgress = percent !== null;
  const hasMeasuredBytes = typeof completed === "number";
  const progressDescription = describeProgress(copy, completed, total, percent, hasMeasuredBytes);

  return (
    <div className='grid gap-2'>
      <progress
        aria-label={copy.progress}
        aria-valuetext={hasMeasuredProgress ? `${percent}%` : copy.progressUnknown}
        className='bg-muted [&::-webkit-progress-bar]:bg-muted h-2 w-full appearance-none overflow-hidden rounded-full accent-cyan-400 [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-cyan-400 [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-cyan-400'
        max={100}
        value={percent ?? undefined}
      />
      <p aria-live='polite' className='text-muted-foreground text-xs'>
        {progressDescription}
      </p>
    </div>
  );
}

function describeProgress(
  copy: LocalModelCopy,
  completed: number | undefined,
  total: number | undefined,
  percent: number | null,
  hasMeasuredBytes: boolean,
): string {
  if (percent !== null && completed !== undefined && total !== undefined) {
    return `${percent}% · ${formatBytes(completed)} / ${formatBytes(total)}`;
  }
  if (hasMeasuredBytes && completed !== undefined) {
    return `${copy.downloaded}: ${formatBytes(completed)}`;
  }
  return copy.progressUnknown;
}

function formatBytes(bytes: number): string {
  return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
}
