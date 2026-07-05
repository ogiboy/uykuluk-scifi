import type { StudioRunDetail } from "./runSummaries";

export type StudioApprovalActionId =
  "cost.approve" | "idea.approve" | "render.approve" | "script.approve";

export type StudioApprovalActionConfig = Readonly<{
  actionId: StudioApprovalActionId;
  buttonLabel: string;
  description: string;
  heading: string;
  routePath: string;
}>;

/**
 * Chooses the guarded Studio approval action for the current run state.
 *
 * @param run - The run state projection.
 * @returns The matching action config, or `null` when no approval action is available.
 */
export function approvalActionForRun(
  run: Pick<StudioRunDetail, "state">,
): StudioApprovalActionConfig | null {
  if (run.state === "IDEAS_GENERATED") {
    return {
      actionId: "idea.approve",
      buttonLabel: "Approve idea",
      description: "Choose exactly one generated idea for this run.",
      heading: "Approve Idea",
      routePath: "/actions/approve-idea",
    };
  }
  if (run.state === "SCRIPT_REVIEWED") {
    return {
      actionId: "script.approve",
      buttonLabel: "Approve script",
      description: "Approve the currently reviewed script digest.",
      heading: "Approve Script",
      routePath: "/actions/approve-script",
    };
  }
  if (run.state === "COST_ESTIMATED") {
    return {
      actionId: "cost.approve",
      buttonLabel: "Approve cost",
      description: "Approve the exact current paid-generation cost quote digest.",
      heading: "Approve Cost",
      routePath: "/actions/approve-cost",
    };
  }
  if (run.state === "READY_FOR_MANUAL_PRODUCTION") {
    return {
      actionId: "render.approve",
      buttonLabel: "Approve render",
      description: "Approve local draft render execution for the current render inputs.",
      heading: "Approve Local Render",
      routePath: "/actions/approve-render",
    };
  }
  return null;
}

/**
 * Checks whether the transient Studio approval form has enough data to submit.
 *
 * @param config - The active approval action config.
 * @param ideaId - The selected idea id for idea approval.
 * @returns `true` when the form can request confirmation.
 */
export function approvalFormReady(config: StudioApprovalActionConfig, ideaId: string): boolean {
  return config.actionId !== "idea.approve" || ideaId.trim().length > 0;
}

/**
 * Builds the guarded Studio approval request body.
 *
 * @param actionId - The approval action id.
 * @param runId - The run receiving approval evidence.
 * @param ideaId - The selected idea id for idea approval.
 * @param acknowledgeWarnings - Whether script warning acknowledgement is explicit.
 * @returns The JSON body sent to the matching Studio action route.
 */
export function approvalPayload(
  actionId: StudioApprovalActionId,
  runId: string,
  ideaId: string,
  acknowledgeWarnings: boolean,
): Record<string, boolean | string> {
  if (actionId === "idea.approve") {
    return { ideaId, runId };
  }
  if (actionId === "script.approve") {
    return { acknowledgeWarnings, runId };
  }
  return { runId };
}

/**
 * Returns the current CLI equivalent only when it actually matches the active approval action.
 *
 * Evidence/readiness remediation commands can be recommended while an approval form is still
 * available from the persisted state. Studio must not show those remediation commands as the CLI
 * equivalent for an approval button.
 *
 * @param config - The active approval action.
 * @param runId - The current run id.
 * @param nextRecommendedCommand - The command projected by CLI/core status.
 * @returns The matching approval command, or `null` when the next command is for another action.
 */
export function approvalCommandForRun(
  config: StudioApprovalActionConfig,
  runId: string,
  nextRecommendedCommand: string | null,
): string | null {
  if (!nextRecommendedCommand) {
    return null;
  }
  return commandMatchesApproval(config, runId, nextRecommendedCommand)
    ? nextRecommendedCommand
    : null;
}

function commandMatchesApproval(
  config: StudioApprovalActionConfig,
  runId: string,
  command: string,
): boolean {
  const tokens = commandTokens(command);
  const prefixTokens = commandTokens(approvalCommandPrefix(config.actionId));
  if (!prefixTokens.every((token, index) => tokens[index] === token)) {
    return false;
  }
  const runFlagIndex = tokens.findIndex(
    (token, index) => index >= prefixTokens.length && token === "--run",
  );
  return runFlagIndex >= 0 && tokens[runFlagIndex + 1] === runId;
}

function approvalCommandPrefix(actionId: StudioApprovalActionId): string {
  switch (actionId) {
    case "cost.approve":
      return "pnpm producer approve cost";
    case "idea.approve":
      return "pnpm producer approve idea";
    case "render.approve":
      return "pnpm producer approve render";
    case "script.approve":
      return "pnpm producer approve script";
  }
}

function commandTokens(command: string): string[] {
  return command.trim().split(/\s+/).filter(Boolean);
}
