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
      <div
        aria-label={copy.progress}
        aria-valuemax={hasMeasuredProgress ? 100 : undefined}
        aria-valuemin={hasMeasuredProgress ? 0 : undefined}
        aria-valuenow={percent ?? undefined}
        aria-valuetext={hasMeasuredProgress ? `${percent}%` : copy.progressUnknown}
        className='bg-muted relative h-2 overflow-hidden rounded-full'
        role='progressbar'
      >
        <div
          className={
            hasMeasuredProgress
              ? "h-full rounded-full bg-cyan-400 transition-[width] duration-500 motion-reduce:transition-none"
              : "h-full w-full animate-pulse rounded-full bg-cyan-400/25 motion-reduce:animate-none"
          }
          style={hasMeasuredProgress ? { width: `${percent}%` } : undefined}
        />
      </div>
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
