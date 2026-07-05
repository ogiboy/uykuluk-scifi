import {
  RunDetailCard,
  RunDetailStatusBadge,
  RunMetadataList,
  type RunMetadataItem,
} from "@/components/runs/RunDetailCard";
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
  const metadataItems =
    renderDecision.kind === "present" ? renderDecisionMetadataItems(renderDecision) : [];

  return (
    <RunDetailCard
      headingId='render-decision-status-heading'
      title='Render Decision Status'
      description='Read-only display. Use the CLI to record or repair local render decisions.'
    >
      <p className='flex flex-wrap items-center gap-2'>
        <RunDetailStatusBadge tone={renderDecisionStatusTone(renderDecision.kind)}>
          {renderDecision.kind}
        </RunDetailStatusBadge>
        <span>{renderDecision.message}</span>
      </p>
      {metadataItems.length > 0 ? <RunMetadataList items={metadataItems} /> : null}
      {renderDecision.nextAction ? (
        <p className='rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100'>
          Next action: {renderDecision.nextAction}
        </p>
      ) : null}
      {renderDecision.kind === "present" ? (
        <p className='rounded-lg border bg-muted/20 p-3 font-mono text-xs break-all text-muted-foreground'>
          Review command: {renderDecision.reviewCommand}
        </p>
      ) : null}
    </RunDetailCard>
  );
}

function renderDecisionStatusTone(
  status: StudioRunDetail["renderDecision"]["kind"],
): "blocked" | "success" | "warning" {
  if (status === "present") {
    return "success";
  }
  if (status === "missing") {
    return "warning";
  }
  return "blocked";
}

function renderDecisionMetadataItems(
  renderDecision: Extract<StudioRunDetail["renderDecision"], { kind: "present" }>,
): RunMetadataItem[] {
  return [
    { label: "Decision", value: renderDecision.decision.decision },
    { label: "Reviewed by", value: renderDecision.decision.reviewedBy },
    { label: "Created", value: renderDecision.decision.createdAt },
  ];
}
