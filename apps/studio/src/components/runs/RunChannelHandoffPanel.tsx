import {
  RunDetailCard,
  RunDetailStatusBadge,
  RunMetadataList,
  type RunMetadataItem,
} from "@/components/runs/RunDetailCard";
import type { StudioRunDetail } from "@/lib/runSummaries";

type RunChannelHandoffPanelProps = Readonly<{
  channelHandoff: StudioRunDetail["channelHandoff"];
}>;

/**
 * Renders the read-only manual channel-handoff status for a run.
 *
 * @param channelHandoff - The Studio manual channel-handoff summary.
 */
export function RunChannelHandoffPanel({ channelHandoff }: RunChannelHandoffPanelProps) {
  const metadataItems =
    channelHandoff.kind === "present" ? channelHandoffMetadataItems(channelHandoff) : [];

  return (
    <RunDetailCard
      headingId='channel-handoff-heading'
      title='Manual Channel Handoff'
      description='Read-only display. This package does not upload, schedule, publish, or approve upload.'
    >
      <p className='flex flex-wrap items-center gap-2'>
        <RunDetailStatusBadge tone={channelHandoffStatusTone(channelHandoff.kind)}>
          {channelHandoff.kind}
        </RunDetailStatusBadge>
        <span>{channelHandoff.message}</span>
      </p>
      {metadataItems.length > 0 ? <RunMetadataList items={metadataItems} /> : null}
      {channelHandoff.nextAction ? (
        <p className='rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100'>
          Next action: {channelHandoff.nextAction}
        </p>
      ) : null}
    </RunDetailCard>
  );
}

function channelHandoffStatusTone(
  status: StudioRunDetail["channelHandoff"]["kind"],
): "blocked" | "success" | "warning" {
  if (status === "present") {
    return "success";
  }
  if (status === "missing") {
    return "warning";
  }
  return "blocked";
}

function channelHandoffMetadataItems(
  channelHandoff: Extract<StudioRunDetail["channelHandoff"], { kind: "present" }>,
): RunMetadataItem[] {
  return [
    { label: "Status", value: channelHandoff.handoff.status },
    { label: "Manual handoff", value: channelHandoff.reviewPath },
    { label: "Draft MP4", value: channelHandoff.handoff.media.draftRenderPath },
    { label: "Subtitles", value: channelHandoff.handoff.media.subtitlesPath },
    { label: "YouTube title", value: channelHandoff.handoff.youtube.title },
    { label: "Metadata JSON", value: channelHandoff.handoff.youtube.metadataPath },
    { label: "Created", value: channelHandoff.handoff.createdAt },
  ];
}
