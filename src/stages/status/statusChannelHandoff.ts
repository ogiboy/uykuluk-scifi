import type { ChannelHandoffStatus } from "../channel/channelHandoffStatus.js";

/**
 * Formats manual channel-handoff status lines for the operator status report.
 *
 * @param handoff - The current manual channel-handoff status.
 * @returns Status lines for the manual channel-handoff section.
 */
export function formatChannelHandoffStatus(handoff: ChannelHandoffStatus): string[] {
  if (handoff.kind === "missing") {
    return handoff.nextAction
      ? [
          "Manual channel handoff: missing",
          `Manual channel handoff next action: ${handoff.nextAction}`,
        ]
      : ["Manual channel handoff: not applicable"];
  }
  if (handoff.kind === "present") {
    return [
      `Manual channel handoff: ${handoff.handoff.status}`,
      `Manual channel handoff artifact: ${handoff.reviewPath}`,
      `Manual channel handoff next action: ${handoff.nextAction}`,
    ];
  }
  return [
    `Manual channel handoff: ${handoff.kind} (${handoff.message})`,
    `Manual channel handoff next action: ${handoff.nextAction}`,
  ];
}
