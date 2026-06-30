import type { StudioRunDetail } from "@/lib/runSummaries";

type RunRenderDecisionStatusPanelProps = Readonly<{
  renderDecision: StudioRunDetail["renderDecision"];
}>;

/**
 * Renders the persisted local render-decision status for a run.
 *
 * @param renderDecision - The read-only render decision summary from the Studio run service.
 */
export function RunRenderDecisionStatusPanel({
  renderDecision,
}: RunRenderDecisionStatusPanelProps) {
  return (
    <section className='panel' aria-labelledby='render-decision-status-heading'>
      <h2 id='render-decision-status-heading'>Render Decision Status</h2>
      <p>
        <span className={renderDecisionStatusClassName(renderDecision.kind)}>
          {renderDecision.kind}
        </span>{" "}
        {renderDecision.message}
      </p>
      {renderDecision.kind === "present" ? (
        <dl className='run-metadata'>
          <div>
            <dt>Decision</dt>
            <dd>{renderDecision.decision.decision}</dd>
          </div>
          <div>
            <dt>Reviewed by</dt>
            <dd>{renderDecision.decision.reviewedBy}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{renderDecision.decision.createdAt}</dd>
          </div>
        </dl>
      ) : null}
      {renderDecision.nextAction ? (
        <p className='artifact-action'>Next action: {renderDecision.nextAction}</p>
      ) : null}
      {renderDecision.kind === "present" ? (
        <p className='artifact-action'>Review command: {renderDecision.reviewCommand}</p>
      ) : null}
      <p>Read-only display. Use the CLI to record or repair local render decisions.</p>
    </section>
  );
}

function renderDecisionStatusClassName(status: StudioRunDetail["renderDecision"]["kind"]): string {
  if (status === "present") {
    return "status-pill small";
  }
  if (status === "missing") {
    return "status-pill small warning";
  }
  return "status-pill small blocked";
}
