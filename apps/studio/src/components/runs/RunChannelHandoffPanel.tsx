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
  return (
    <section className='panel' aria-labelledby='channel-handoff-heading'>
      <h2 id='channel-handoff-heading'>Manual Channel Handoff</h2>
      <p>
        <span className={channelHandoffStatusClassName(channelHandoff.kind)}>
          {channelHandoff.kind}
        </span>{" "}
        {channelHandoff.message}
      </p>
      {channelHandoff.kind === "present" ? (
        <dl className='run-metadata'>
          <div>
            <dt>Status</dt>
            <dd>{channelHandoff.handoff.status}</dd>
          </div>
          <div>
            <dt>Manual handoff</dt>
            <dd>{channelHandoff.reviewPath}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{channelHandoff.handoff.createdAt}</dd>
          </div>
        </dl>
      ) : null}
      {channelHandoff.nextAction ? (
        <p className='artifact-action'>Next action: {channelHandoff.nextAction}</p>
      ) : null}
      <p>Read-only display. This package does not upload, schedule, publish, or approve upload.</p>
    </section>
  );
}

function channelHandoffStatusClassName(status: StudioRunDetail["channelHandoff"]["kind"]): string {
  if (status === "present") {
    return "status-pill small";
  }
  if (status === "missing") {
    return "status-pill small warning";
  }
  return "status-pill small blocked";
}
