import type { StudioMutationActionId } from "../../../../src/studio/actionServiceMetadata";
import type { StudioRunDetail } from "./runSummaries";

export type StudioStageActionId = Extract<
  StudioMutationActionId,
  | "channel-handoff.run"
  | "estimate.run"
  | "evidence.run"
  | "package.run"
  | "readiness.run"
  | "render.review"
  | "render.run"
  | "render-plan.review"
  | "render-plan.run"
  | "review-bundle.run"
  | "script.review"
  | "script.run"
  | "voice.review"
  | "voice.run"
>;

export type StudioStageActionConfig = Readonly<{
  actionId: StudioStageActionId;
  buttonLabel: string;
  commandPrefix: string;
  description: string;
  heading: string;
  routePath: string;
}>;

export type StudioStageActionRun = Pick<
  StudioRunDetail,
  "nextRecommendedCommand" | "runId" | "state"
>;

export const studioStageActionConfigs = [
  stageAction(
    "script.run",
    "/actions/run-script",
    "script",
    "Generate Script",
    "Generate the next script draft for the approved idea.",
  ),
  stageAction(
    "script.review",
    "/actions/review-script",
    "review script",
    "Review Script",
    "Run the local script review and persist warnings/blockers for approval.",
  ),
  stageAction(
    "package.run",
    "/actions/run-package",
    "package",
    "Generate Package",
    "Generate production package artifacts from the approved script.",
  ),
  stageAction(
    "render-plan.run",
    "/actions/run-render-plan",
    "render-plan",
    "Generate Render Plan",
    "Generate the deterministic render plan, contact sheet, and asset provenance.",
  ),
  stageAction(
    "render-plan.review",
    "/actions/review-render-plan",
    "review render-plan",
    "Review Render Plan",
    "Open the render-plan handoff through the canonical local review command.",
  ),
  stageAction(
    "estimate.run",
    "/actions/run-estimate",
    "estimate",
    "Regenerate Estimate",
    "Regenerate the current cost estimate before approval or readiness work.",
  ),
  stageAction(
    "evidence.run",
    "/actions/run-evidence",
    "evidence",
    "Regenerate Evidence",
    "Regenerate evidence from persisted artifacts so Studio status can trust it.",
  ),
  stageAction(
    "readiness.run",
    "/actions/run-readiness",
    "readiness",
    "Run Readiness",
    "Run readiness diagnostics through the canonical local workflow.",
  ),
  stageAction(
    "voice.run",
    "/actions/run-voice",
    "voice",
    "Generate Voiceover",
    "Generate local voiceover only when TTS config and workflow guards allow it.",
  ),
  stageAction(
    "voice.review",
    "/actions/review-voice",
    "review voice",
    "Review Voiceover",
    "Open the local voiceover review handoff before render approval.",
  ),
  stageAction(
    "render.run",
    "/actions/run-render",
    "render",
    "Render Draft",
    "Generate the local FFmpeg draft after exact render approval.",
  ),
  stageAction(
    "render.review",
    "/actions/review-render",
    "review render",
    "Review Draft Render",
    "Open the local draft-render review handoff without upload or publish.",
  ),
  stageAction(
    "review-bundle.run",
    "/actions/run-review-bundle",
    "review-bundle",
    "Create Final Review Bundle",
    "Create the final local review bundle after the render decision.",
  ),
  stageAction(
    "channel-handoff.run",
    "/actions/run-channel-handoff",
    "channel-handoff",
    "Create Channel Handoff",
    "Create the manual channel handoff package while upload and publish remain disabled.",
  ),
] as const satisfies readonly StudioStageActionConfig[];

/**
 * Finds the guarded Studio workflow action matching the current next recommended command.
 *
 * @param run - The run projection containing the materialized next command.
 * @returns A stage action config, or `null` when the next action is still CLI-only.
 */
export function stageActionForRun(run: StudioStageActionRun): StudioStageActionConfig | null {
  const command = run.nextRecommendedCommand?.trim();
  if (!command) {
    return null;
  }
  return (
    studioStageActionConfigs.find((config) =>
      command.startsWith(`${config.commandPrefix} --run ${run.runId}`),
    ) ?? null
  );
}

function stageAction(
  actionId: StudioStageActionId,
  routePath: string,
  producerCommand: string,
  heading: string,
  description: string,
): StudioStageActionConfig {
  return {
    actionId,
    buttonLabel: heading,
    commandPrefix: `pnpm producer ${producerCommand}`,
    description,
    heading,
    routePath,
  };
}
