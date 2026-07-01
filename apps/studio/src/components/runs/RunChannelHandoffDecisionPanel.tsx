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
  return (
    <section className='panel' aria-labelledby='channel-handoff-decision-heading'>
      <h2 id='channel-handoff-decision-heading'>Manual Channel Handoff Decision</h2>
      <p>
        <span className={channelHandoffDecisionStatusClassName(channelHandoffDecision.kind)}>
          {channelHandoffDecision.kind}
        </span>{" "}
        {channelHandoffDecision.message}
      </p>
      {channelHandoffDecision.kind === "present" ? (
        <dl className='run-metadata'>
          <div>
            <dt>Decision</dt>
            <dd>{channelHandoffDecision.decision.decision}</dd>
          </div>
          <div>
            <dt>Reviewed by</dt>
            <dd>{channelHandoffDecision.decision.reviewedBy}</dd>
          </div>
          <div>
            <dt>Selected thumbnail</dt>
            <dd>
              {channelHandoffDecision.decision.selectedThumbnailCandidate?.candidateId ?? "-"}
            </dd>
          </div>
          <div>
            <dt>Decision artifact</dt>
            <dd>{channelHandoffDecision.reviewPath}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{channelHandoffDecision.decision.createdAt}</dd>
          </div>
        </dl>
      ) : null}
      {channelHandoffDecision.nextAction ? (
        <p className='artifact-action'>Next action: {channelHandoffDecision.nextAction}</p>
      ) : null}
      <p>Read-only display. This decision does not upload, schedule, publish, or approve upload.</p>
    </section>
  );
}

function channelHandoffDecisionStatusClassName(
  status: StudioRunDetail["channelHandoffDecision"]["kind"],
): string {
  if (status === "present") {
    return "status-pill small";
  }
  if (status === "missing") {
    return "status-pill small warning";
  }
  return "status-pill small blocked";
}
