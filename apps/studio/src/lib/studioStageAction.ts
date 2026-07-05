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

type StudioStageActionFields = readonly [string, string, string, string];

// prettier-ignore
const studioStageActionRows = {
  "script.run": ["/actions/run-script", "script", "Generate Script", "Generate the next script draft for the approved idea."],
  "script.review": ["/actions/review-script", "review script", "Review Script", "Run the local script review and persist warnings/blockers for approval."],
  "package.run": ["/actions/run-package", "package", "Generate Package", "Generate production package artifacts from the approved script."],
  "render-plan.run": ["/actions/run-render-plan", "render-plan", "Generate Render Plan", "Generate the deterministic render plan, contact sheet, and asset provenance."],
  "render-plan.review": ["/actions/review-render-plan", "review render-plan", "Review Render Plan", "Open the render-plan handoff through the canonical local review command."],
  "estimate.run": ["/actions/run-estimate", "estimate", "Regenerate Estimate", "Regenerate the current cost estimate before approval or readiness work."],
  "evidence.run": ["/actions/run-evidence", "evidence", "Regenerate Evidence", "Regenerate evidence from persisted artifacts so Studio status can trust it."],
  "readiness.run": ["/actions/run-readiness", "readiness", "Run Readiness", "Run readiness diagnostics through the canonical local workflow."],
  "voice.run": ["/actions/run-voice", "voice", "Generate Voiceover", "Generate local voiceover only when TTS config and workflow guards allow it."],
  "voice.review": ["/actions/review-voice", "review voice", "Review Voiceover", "Open the local voiceover review handoff before render approval."],
  "render.run": ["/actions/run-render", "render", "Render Draft", "Generate the local FFmpeg draft after exact render approval."],
  "render.review": ["/actions/review-render", "review render", "Review Draft Render", "Open the local draft-render review handoff without upload or publish."],
  "review-bundle.run": ["/actions/run-review-bundle", "review-bundle", "Create Final Review Bundle", "Create the final local review bundle after the render decision."],
  "channel-handoff.run": ["/actions/run-channel-handoff", "channel-handoff", "Create Channel Handoff", "Create the manual channel handoff package while upload and publish remain disabled."],
} as const satisfies Record<StudioStageActionId, StudioStageActionFields>;

const studioStageActionIds = Object.keys(studioStageActionRows) as StudioStageActionId[];

export const studioStageActionConfigs = studioStageActionIds.map((actionId) => {
  const [routePath, producerCommand, heading, description] = studioStageActionRows[actionId];
  return stageAction(actionId, routePath, producerCommand, heading, description);
}) satisfies readonly StudioStageActionConfig[];

/**
 * Looks up a guarded Studio stage-action config by id.
 *
 * @param actionId - The route-backed action identifier to resolve.
 * @returns The matching action config, or `null` if the id is not stage-owned.
 */
export function studioStageActionConfig(
  actionId: StudioStageActionId,
): StudioStageActionConfig | null {
  return studioStageActionConfigs.find((config) => config.actionId === actionId) ?? null;
}

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
      commandMatchesStageAction(command, run.runId, config.commandPrefix),
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

function commandMatchesStageAction(command: string, runId: string, commandPrefix: string): boolean {
  const tokens = commandTokens(command);
  const prefixTokens = commandTokens(commandPrefix);
  if (!tokensStartWith(tokens, prefixTokens)) {
    return false;
  }
  const runFlagIndex = tokens.findIndex(
    (token, index) => index >= prefixTokens.length && token === "--run",
  );
  return runFlagIndex >= 0 && tokens[runFlagIndex + 1] === runId;
}

function commandTokens(command: string): string[] {
  return command.trim().split(/\s+/).filter(Boolean);
}

function tokensStartWith(tokens: readonly string[], prefixTokens: readonly string[]): boolean {
  return prefixTokens.every((token, index) => tokens[index] === token);
}
