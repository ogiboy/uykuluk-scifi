import type { ChannelHandoffDecisionStatus } from "../channel/channelHandoffDecisionStatus.js";

/**
 * Formats the durable channel handoff decision for operator output.
 *
 * @param decision - The channel handoff decision status.
 * @returns Lines describing the decision and its next action.
 */
export function formatChannelHandoffDecisionStatus(
  decision: ChannelHandoffDecisionStatus,
): string[] {
  if (decision.kind === "missing") {
    return decision.nextAction
      ? [
          "Channel handoff decision: missing",
          `Channel handoff decision next action: ${decision.nextAction}`,
        ]
      : ["Channel handoff decision: not applicable"];
  }
  if (decision.kind === "present") {
    return [
      `Channel handoff decision: ${decision.decision.decision} by ${decision.decision.reviewedBy}`,
      `Channel handoff decision artifact: ${decision.reviewPath}`,
      `Channel handoff decision next action: ${decision.nextAction}`,
    ];
  }
  return [
    `Channel handoff decision: ${decision.kind} (${decision.message})`,
    `Channel handoff decision next action: ${decision.nextAction}`,
  ];
}
