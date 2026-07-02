import type { StudioRunDetail } from "@/lib/runSummaries";
import { StudioMutationSessionPanel } from "../studio/StudioMutationSessionPanel";
import { RunApprovalActionPanel } from "./RunApprovalActionPanel";
import { RunBlockedActionsPanel } from "./RunBlockedActionsPanel";
import { RunChannelHandoffDecisionPanel } from "./RunChannelHandoffDecisionPanel";
import { RunRenderDecisionActionPanel } from "./RunRenderDecisionActionPanel";
import { RunRenderDecisionCommandsPanel } from "./RunRenderDecisionCommandsPanel";
import { RunRenderDecisionStatusPanel } from "./RunRenderDecisionStatusPanel";

type RunReviewDecisionRailProps = Readonly<{
  run: StudioRunDetail;
}>;

/**
 * Renders guarded local decision and approval controls for a run.
 *
 * @param run - The Studio run detail projection used to display decision state.
 */
export function RunReviewDecisionRail({ run }: RunReviewDecisionRailProps) {
  return (
    <div className='run-review-rail' aria-label='Run decisions and blocked actions'>
      <StudioMutationSessionPanel />
      <RunBlockedActionsPanel
        blockedActions={run.blockedActions}
        evidenceMessage={run.evidenceMessage}
        evidenceNextAction={run.evidenceNextAction}
        evidenceStatus={run.evidenceStatus}
      />
      <RunApprovalActionPanel run={run} />
      <RunRenderDecisionStatusPanel renderDecision={run.renderDecision} />
      <RunRenderDecisionActionPanel
        commands={run.renderDecisionCommands}
        run={run}
        runId={run.runId}
      />
      <RunRenderDecisionCommandsPanel commands={run.renderDecisionCommands} />
      <RunChannelHandoffDecisionPanel channelHandoffDecision={run.channelHandoffDecision} />
    </div>
  );
}
