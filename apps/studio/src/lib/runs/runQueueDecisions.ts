import type { StudioRunSummary } from "../runSummaries";

/**
 * Checks whether a run is waiting for an operator render-review decision.
 *
 * @param run - The Studio run summary to inspect.
 * @returns `true` when the run has rendered local media but no trusted render decision.
 */
export function needsRenderReviewDecision(run: StudioRunSummary): boolean {
  return run.state === "RENDERED" && run.renderDecision.kind !== "present";
}

/**
 * Checks whether a run is waiting for an operator manual channel-handoff decision.
 *
 * @param run - The Studio run summary to inspect.
 * @returns `true` when trusted channel handoff evidence exists but no trusted handoff decision does.
 */
export function needsChannelHandoffDecision(run: StudioRunSummary): boolean {
  return run.channelHandoff.kind === "present" && run.channelHandoffDecision.kind !== "present";
}

/**
 * Checks whether any local operator review decision is currently needed.
 *
 * @param run - The Studio run summary to inspect.
 * @returns `true` when render review or channel handoff review is waiting for a decision.
 */
export function needsOperatorReviewDecision(run: StudioRunSummary): boolean {
  return needsRenderReviewDecision(run) || needsChannelHandoffDecision(run);
}

/**
 * Scores pending decision work for operator queue sorting.
 *
 * @param run - The Studio run summary to score.
 * @returns Higher values for later-stage pending decisions that should be surfaced first.
 */
export function operatorDecisionPriority(run: StudioRunSummary): number {
  if (needsChannelHandoffDecision(run)) {
    return 2;
  }
  if (needsRenderReviewDecision(run)) {
    return 1;
  }
  return 0;
}
