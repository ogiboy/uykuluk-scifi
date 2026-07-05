import type { StudioRunDetail } from "@/lib/runSummaries";
import { StudioMutationSessionPanel } from "../studio/StudioMutationSessionPanel";
import { RunActionWorkbenchPanel } from "./RunActionWorkbenchPanel";
import { RunApprovalActionPanel } from "./RunApprovalActionPanel";
import { RunChannelHandoffDecisionActionPanel } from "./RunChannelHandoffDecisionActionPanel";
import { RunBlockedActionsPanel } from "./RunBlockedActionsPanel";
import { RunChannelHandoffDecisionPanel } from "./RunChannelHandoffDecisionPanel";
import { RunRenderDecisionActionPanel } from "./RunRenderDecisionActionPanel";
import { RunRenderDecisionCommandsPanel } from "./RunRenderDecisionCommandsPanel";
import { RunRenderDecisionStatusPanel } from "./RunRenderDecisionStatusPanel";
import { RunRevisionActionPanel } from "./RunRevisionActionPanel";
import { RunStageActionPanel } from "./RunStageActionPanel";

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
    <section
      className='run-review-rail'
      id='review-decision'
      aria-label='Run decisions and blocked actions'
    >
      <StudioMutationSessionPanel />
      <RunActionWorkbenchPanel run={run} />
      <RunBlockedActionsPanel
        blockedActions={run.blockedActions}
        evidenceMessage={run.evidenceMessage}
        evidenceNextAction={run.evidenceNextAction}
        evidenceStatus={run.evidenceStatus}
      />
      <RunRevisionActionPanel run={run} />
      <RunStageActionPanel run={run} />
      <RunApprovalActionPanel run={run} />
      <RunRenderDecisionStatusPanel renderDecision={run.renderDecision} />
      <RunRenderDecisionActionPanel
        commands={run.renderDecisionCommands}
        run={run}
        runId={run.runId}
      />
      <RunRenderDecisionCommandsPanel commands={run.renderDecisionCommands} />
      <RunChannelHandoffDecisionActionPanel run={run} />
      <RunChannelHandoffDecisionPanel channelHandoffDecision={run.channelHandoffDecision} />
    </section>
  );
}
