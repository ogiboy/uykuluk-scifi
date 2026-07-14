import {
  buildStudioActionWorkbench,
  type StudioActionWorkbenchPrimary,
  type StudioActionWorkbenchRun,
} from "../actions/studioActionWorkbench";
import { stageActionForRun, type StudioStageActionRun } from "../actions/studioStageAction";
import type { StudioRunDetail } from "../runSummaries";

export type StudioRunPrimaryActionMode = "command" | "complete" | "rail" | "stage";

export type StudioRunPrimaryAction = Readonly<{
  command: string | null;
  description: string;
  label: string;
  mode: StudioRunPrimaryActionMode;
  routePath: string | null;
  tone: StudioActionWorkbenchPrimary["tone"];
}>;

export type StudioRunPrimaryActionRun = StudioActionWorkbenchRun &
  StudioStageActionRun &
  Partial<Pick<StudioRunDetail, "voiceAudition">>;

/**
 * Projects the most useful Studio primary action for the run detail hero and mobile sheet.
 *
 * The projection only decides presentation. Guarded routes and CLI/core still own mutation
 * authorization, state validation, approvals, evidence, cost, upload, and publish safety.
 *
 * @param run - The run projection used to choose the current Studio action affordance.
 * @returns The primary action summary and preferred presentation mode.
 */
export function buildStudioRunPrimaryAction(
  run: StudioRunPrimaryActionRun,
): StudioRunPrimaryAction {
  const stageAction = stageActionForRun(run);
  const workbench = buildStudioActionWorkbench(run);
  const hostedVoiceAction =
    stageAction?.actionId === "voice.run" && run.voiceAudition?.production.hostedExecution;
  if (
    hostedVoiceAction &&
    run.blockedActionCount === 0 &&
    run.readinessStatus === "passed" &&
    workbench.primary.tone === "available"
  ) {
    return {
      command: run.nextRecommendedCommand,
      description:
        "Open Voice to review and explicitly confirm the exact hosted binding, quote, and approval before synthesis.",
      label: stageAction.heading,
      mode: "rail",
      routePath: stageAction.routePath,
      tone: "available",
    };
  }
  if (hostedVoiceAction) {
    return {
      command: run.nextRecommendedCommand,
      description:
        "Hosted voice confirmation is unavailable until current readiness and blocked-action checks pass.",
      label: stageAction.heading,
      mode: "command",
      routePath: null,
      tone: "blocked",
    };
  }
  if (
    stageAction &&
    workbench.primary.tone === "available" &&
    workbench.primary.routePath === stageAction.routePath
  ) {
    return {
      ...workbench.primary,
      description: `${workbench.primary.description} You can run this step directly here or inspect the full action rail first.`,
      mode: "stage",
    };
  }
  if (workbench.primary.routePath && workbench.primary.tone === "available") {
    return {
      ...workbench.primary,
      description: `${workbench.primary.description} Open the action rail to review the form preflight and confirmation details.`,
      mode: "rail",
    };
  }
  if (workbench.primary.command) {
    return { ...workbench.primary, mode: "command" };
  }
  return { ...workbench.primary, mode: "complete" };
}
