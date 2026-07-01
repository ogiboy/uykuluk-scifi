import type { RenderDecisionStatus } from "../stages/renderDecisionStatus.js";

/**
 * Summarizes a render decision for display.
 *
 * @param decision - The render decision status to summarize.
 * @returns A display string for the render decision.
 */
export function renderDecisionSummary(decision: RenderDecisionStatus): string {
  if (decision.kind === "present") {
    return `${decision.decision.decision} by ${decision.decision.reviewedBy}`;
  }
  return decision.kind;
}

/**
 * Formats render-decision review lines for operator desk details.
 *
 * @param decision - The render decision status to format.
 * @returns Review command lines when a decision is present.
 */
export function renderDecisionReviewLines(decision: RenderDecisionStatus): string[] {
  return decision.kind === "present" ? [`Render decision review: ${decision.reviewCommand}`] : [];
}
