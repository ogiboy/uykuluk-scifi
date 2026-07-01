import type { RenderDecisionStatus } from "../stages/renderDecisionStatus.js";
import type { RunStatusSummary } from "../stages/status.js";
import type { ProductionMediaStatus } from "../stages/statusMedia.js";

export type OperatorDeskCommand = {
  command: string;
  label: string;
};

/**
 * Builds the copyable operator command queue from the shared status summary.
 *
 * @param status - Current status summary for the selected run.
 * @returns Deduplicated operator commands that remain within CLI/core boundaries.
 */
export function buildOperatorDeskCommandQueue(status: RunStatusSummary): OperatorDeskCommand[] {
  const commands: OperatorDeskCommand[] = [];
  const seen = new Set<string>();

  const addCommand = (label: string, command: string | null | undefined) => {
    if (!isCopyableProducerCommand(command) || seen.has(command)) {
      return;
    }
    seen.add(command);
    commands.push({ command, label });
  };

  addCommand("Next safe action", status.nextRecommendedCommand);
  addReadinessCommands(status.readiness, addCommand);
  addMediaCommands(status, addCommand);
  addRenderDecisionCommands(status.renderDecision, addCommand);
  addFinalReviewBundleCommand(status, addCommand);
  addChannelHandoffDecisionCommand(status, addCommand);

  return commands;
}

function addChannelHandoffDecisionCommand(
  status: RunStatusSummary,
  addCommand: (label: string, command: string | null | undefined) => void,
): void {
  if (
    status.channelHandoffDecision.kind === "missing" ||
    status.channelHandoffDecision.kind === "invalid" ||
    status.channelHandoffDecision.kind === "stale"
  ) {
    addCommand("Channel handoff decision", status.channelHandoffDecision.nextAction);
  }
}

function addFinalReviewBundleCommand(
  status: RunStatusSummary,
  addCommand: (label: string, command: string | null | undefined) => void,
): void {
  if (
    status.finalReviewBundle.kind === "missing" ||
    status.finalReviewBundle.kind === "invalid" ||
    status.finalReviewBundle.kind === "stale"
  ) {
    addCommand("Final review bundle", status.finalReviewBundle.nextAction);
  }
}

/**
 * Formats the copyable operator command queue for desk output.
 *
 * @param commands - Commands derived from the current status summary.
 * @returns Lines for the operator command section.
 */
export function formatOperatorDeskCommandLines(commands: readonly OperatorDeskCommand[]): string[] {
  if (commands.length === 0) {
    return ["Operator commands:", "- none"];
  }
  return ["Operator commands:", ...commands.map((item) => `- ${item.label}: ${item.command}`)];
}

function addReadinessCommands(
  readiness: RunStatusSummary["readiness"],
  addCommand: (label: string, command: string | null | undefined) => void,
): void {
  switch (readiness.status) {
    case "missing":
    case "invalid":
    case "stale":
      addCommand("Readiness", readiness.nextAction);
      return;
    case "blocked":
    case "passed":
      for (const check of readiness.attention) {
        addCommand(`Readiness ${check.name}`, check.nextAction);
      }
  }
}

function addMediaCommands(
  status: RunStatusSummary,
  addCommand: (label: string, command: string | null | undefined) => void,
): void {
  for (const artifact of status.mediaArtifacts) {
    addCommand(`Review ${lowercaseFirst(artifact.label)}`, artifact.reviewCommand);
    if (status.run.state === "READY_FOR_MANUAL_PRODUCTION") {
      addCommand(renderApprovalLabel(artifact.renderApprovalScope), artifact.renderApprovalCommand);
    }
  }
}

function addRenderDecisionCommands(
  decision: RenderDecisionStatus,
  addCommand: (label: string, command: string | null | undefined) => void,
): void {
  if (decision.kind === "present") {
    addCommand("Review render decision", decision.reviewCommand);
    return;
  }
  addCommand("Render decision", decision.nextAction);
}

function renderApprovalLabel(scope: ProductionMediaStatus["renderApprovalScope"]): string {
  return scope === "timing-draft-only" ? "Approve timing-draft render" : "Approve render";
}

function isCopyableProducerCommand(command: string | null | undefined): command is string {
  return typeof command === "string" && command.startsWith("pnpm producer ");
}

function lowercaseFirst(value: string): string {
  return value.length > 0 ? `${value[0].toLowerCase()}${value.slice(1)}` : value;
}
