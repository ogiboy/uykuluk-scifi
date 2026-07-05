import {
  RunDetailCard,
  RunDetailStatusBadge,
  RunMetadataList,
  type RunMetadataItem,
} from "@/components/runs/RunDetailCard";
import type { StudioRunDetail } from "@/lib/runSummaries";

type RunChannelHandoffDecisionPanelProps = Readonly<{
  channelHandoffDecision: StudioRunDetail["channelHandoffDecision"];
}>;

/**
 * Renders the read-only manual channel-handoff decision status for a run.
 *
 * @param channelHandoffDecision - The Studio manual channel-handoff decision summary.
 */
export function RunChannelHandoffDecisionPanel({
  channelHandoffDecision,
}: RunChannelHandoffDecisionPanelProps) {
  const metadataItems =
    channelHandoffDecision.kind === "present"
      ? channelHandoffDecisionMetadataItems(channelHandoffDecision)
      : [];

  return (
    <RunDetailCard
      headingId='channel-handoff-decision-heading'
      title='Manual Channel Handoff Decision'
      description='Read-only display. This decision does not upload, schedule, publish, or approve upload.'
    >
      <p className='flex flex-wrap items-center gap-2'>
        <RunDetailStatusBadge tone={channelHandoffDecisionStatusTone(channelHandoffDecision.kind)}>
          {channelHandoffDecision.kind}
        </RunDetailStatusBadge>
        <span>{channelHandoffDecision.message}</span>
      </p>
      {metadataItems.length > 0 ? <RunMetadataList items={metadataItems} /> : null}
      {channelHandoffDecision.nextAction ? (
        <p className='rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100'>
          Next action: {channelHandoffDecision.nextAction}
        </p>
      ) : null}
    </RunDetailCard>
  );
}

function channelHandoffDecisionStatusTone(
  status: StudioRunDetail["channelHandoffDecision"]["kind"],
): "blocked" | "success" | "warning" {
  if (status === "present") {
    return "success";
  }
  if (status === "missing") {
    return "warning";
  }
  return "blocked";
}

function channelHandoffDecisionMetadataItems(
  channelHandoffDecision: Extract<StudioRunDetail["channelHandoffDecision"], { kind: "present" }>,
): RunMetadataItem[] {
  return [
    { label: "Decision", value: channelHandoffDecision.decision.decision },
    { label: "Reviewed by", value: channelHandoffDecision.decision.reviewedBy },
    {
      label: "Selected thumbnail",
      value: channelHandoffDecision.decision.selectedThumbnailCandidate?.candidateId ?? "-",
    },
    { label: "Decision artifact", value: channelHandoffDecision.reviewPath },
    { label: "Created", value: channelHandoffDecision.decision.createdAt },
  ];
}
