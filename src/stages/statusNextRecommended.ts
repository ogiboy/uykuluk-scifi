import type { RunState } from "../core/state.js";
import { materializeRunCommand, staticEvidenceNextCommand } from "./evidenceNextCommand.js";
import type { ChannelHandoffStatus } from "./channelHandoffStatus.js";
import type { ChannelHandoffDecisionStatus } from "./channelHandoffDecisionStatus.js";
import type { FinalReviewBundleStatus } from "./finalReviewBundleStatus.js";
import type { RenderDecisionStatus } from "./renderDecisionStatus.js";
import type { EvidenceReadResult } from "./statusEvidence.js";

/**
 * Chooses the next recommended operator action for a run status summary.
 *
 * @param runId - The run identifier used to fill command templates.
 * @param state - The current run state used when evidence is missing.
 * @param evidenceResult - The resolved evidence status for the run.
 * @param renderDecision - The resolved durable render decision for the run.
 * @param finalReviewBundle - The resolved final-review bundle status for the run.
 * @param channelHandoff - The resolved manual channel-handoff status for the run.
 * @param channelHandoffDecision - The resolved manual channel-handoff decision status for the run.
 * @returns The command or operator action for the next safe step.
 */
export function statusNextRecommendedCommand(
  runId: string,
  state: RunState,
  evidenceResult: EvidenceReadResult,
  renderDecision: RenderDecisionStatus,
  finalReviewBundle: FinalReviewBundleStatus,
  channelHandoff: ChannelHandoffStatus,
  channelHandoffDecision: ChannelHandoffDecisionStatus,
): string {
  if (finalReviewBundle.kind === "invalid" || finalReviewBundle.kind === "stale") {
    return finalReviewBundle.nextAction;
  }
  if (finalReviewBundle.kind === "present") {
    if (channelHandoff.kind === "present") {
      return channelHandoffDecision.nextAction ?? channelHandoff.nextAction;
    }
    if (channelHandoff.kind === "invalid" || channelHandoff.kind === "stale") {
      return channelHandoff.nextAction;
    }
    return finalReviewBundle.nextAction;
  }
  if (finalReviewBundle.kind === "missing" && renderDecision.kind === "present") {
    return finalReviewBundle.nextAction ?? renderDecision.nextAction;
  }
  if (renderDecision.kind === "present") {
    return renderDecision.nextAction;
  }
  if (renderDecision.kind === "invalid" || renderDecision.kind === "stale") {
    return renderDecision.nextAction;
  }
  if (
    evidenceResult.kind === "present" &&
    typeof evidenceResult.evidence.nextRecommendedCommand === "string"
  ) {
    return materializeRunCommand(evidenceResult.evidence.nextRecommendedCommand, runId);
  }
  if (evidenceResult.kind === "missing") {
    return materializeRunCommand(
      staticEvidenceNextCommand(state) ?? "pnpm producer evidence --run <run_id>",
      runId,
    );
  }
  return `pnpm producer evidence --run ${runId}`;
}
