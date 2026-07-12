import type { ChannelHandoffDecisionStatus } from "../stages/channel/channelHandoffDecisionStatus.js";

/**
 * Summarizes the manual channel-handoff decision for compact operator desk surfaces.
 *
 * @param decision - The channel-handoff decision status.
 * @returns A compact operator-facing decision summary.
 */
export function channelHandoffDecisionSummary(decision: ChannelHandoffDecisionStatus): string {
  if (decision.kind === "present") {
    return `${decision.decision.decision} by ${decision.decision.reviewedBy}`;
  }
  return decision.kind;
}

/**
 * Formats detailed manual channel-handoff decision lines for the operator desk.
 *
 * @param decision - The channel-handoff decision status.
 * @returns Detail lines for read-only terminal display.
 */
export function channelHandoffDecisionLines(decision: ChannelHandoffDecisionStatus): string[] {
  if (decision.kind === "present") {
    return [
      `Manual channel handoff decision artifact: ${decision.reviewPath}`,
      `Manual channel handoff decision next action: ${decision.nextAction}`,
    ];
  }
  return decision.nextAction
    ? [`Manual channel handoff decision next action: ${decision.nextAction}`]
    : [];
}
