import type { ChannelHandoffStatus } from "../stages/channelHandoffStatus.js";

/**
 * Summarizes manual channel-handoff status for operator desk compact rows.
 *
 * @param handoff - The channel-handoff status.
 * @returns A short display status.
 */
export function channelHandoffSummary(handoff: ChannelHandoffStatus): string {
  if (handoff.kind === "present") {
    return handoff.handoff.status;
  }
  return handoff.kind;
}

/**
 * Formats manual channel-handoff detail lines for the operator desk.
 *
 * @param handoff - The channel-handoff status.
 * @returns Operator-facing detail lines.
 */
export function channelHandoffLines(handoff: ChannelHandoffStatus): string[] {
  if (handoff.kind === "present") {
    return [
      `Manual channel handoff artifact: ${handoff.reviewPath}`,
      `Manual channel handoff next action: ${handoff.nextAction}`,
    ];
  }
  if (handoff.kind === "missing") {
    return handoff.nextAction ? [`Manual channel handoff next action: ${handoff.nextAction}`] : [];
  }
  return [
    `Manual channel handoff issue: ${handoff.message}`,
    `Manual channel handoff next action: ${handoff.nextAction}`,
  ];
}
