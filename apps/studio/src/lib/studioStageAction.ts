import type { StudioMutationActionId } from "../../../../src/studio/actionServiceMetadata";
import type { StudioRunDetail } from "./runSummaries";

export type StudioStageActionId = Extract<
  StudioMutationActionId,
  | "channel-handoff.run"
  | "estimate.run"
  | "evidence.run"
  | "ideas.run"
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
  requiresRunId: boolean;
  routePath: string;
}>;

export type StudioStageActionRun = Pick<
  StudioRunDetail,
  "nextRecommendedCommand" | "runId" | "state"
>;

type StudioStageActionFields = readonly [string, string, string, string, boolean];

// prettier-ignore
const studioStageActionRows = {
  "ideas.run": ["/actions/run-ideas", "ideas", "Start Ideas Run", "Start a new local idea-generation run through the guarded local route.", false],
  "script.run": ["/actions/run-script", "script", "Generate Script", "Generate the next script draft for the approved idea.", true],
  "script.review": ["/actions/review-script", "review script", "Review Script", "Run the local script review and persist warnings/blockers for approval.", true],
  "package.run": ["/actions/run-package", "package", "Generate Package", "Generate production package artifacts from the approved script.", true],
  "render-plan.run": ["/actions/run-render-plan", "render-plan", "Generate Render Plan", "Generate the deterministic render plan, contact sheet, and asset provenance.", true],
  "render-plan.review": ["/actions/review-render-plan", "review render-plan", "Review Render Plan", "Open the render-plan handoff through the canonical local review command.", true],
  "estimate.run": ["/actions/run-estimate", "estimate", "Regenerate Estimate", "Regenerate the current cost estimate before approval or readiness work.", true],
  "evidence.run": ["/actions/run-evidence", "evidence", "Regenerate Evidence", "Regenerate evidence from persisted artifacts so Studio status can trust it.", true],
  "readiness.run": ["/actions/run-readiness", "readiness", "Run Readiness", "Run readiness diagnostics through the canonical local workflow.", true],
  "voice.run": ["/actions/run-voice", "voice", "Generate Voiceover", "Generate local voiceover only when TTS config and workflow guards allow it.", true],
  "voice.review": ["/actions/review-voice", "review voice", "Review Voiceover", "Open the local voiceover review handoff before render approval.", true],
  "render.run": ["/actions/run-render", "render", "Render Draft", "Generate the local FFmpeg draft after exact render approval.", true],
  "render.review": ["/actions/review-render", "review render", "Review Draft Render", "Open the local draft-render review handoff without upload or publish.", true],
  "review-bundle.run": ["/actions/run-review-bundle", "review-bundle", "Create Final Review Bundle", "Create the final local review bundle after the render decision.", true],
  "channel-handoff.run": ["/actions/run-channel-handoff", "channel-handoff", "Create Channel Handoff", "Create the manual channel handoff package while upload and publish remain disabled.", true],
} as const satisfies Record<StudioStageActionId, StudioStageActionFields>;

const studioStageActionIds = Object.keys(studioStageActionRows) as StudioStageActionId[];

export const studioStageActionConfigs = studioStageActionIds.map((actionId) => {
  const [routePath, producerCommand, heading, description, requiresRunId] =
    studioStageActionRows[actionId];
  return stageAction(actionId, routePath, producerCommand, heading, description, requiresRunId);
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
      config.requiresRunId
        ? commandMatchesRunStageAction(command, run.runId, config.commandPrefix)
        : commandMatchesGlobalStageAction(command, config.commandPrefix),
    ) ?? null
  );
}

function stageAction(
  actionId: StudioStageActionId,
  routePath: string,
  producerCommand: string,
  heading: string,
  description: string,
  requiresRunId: boolean,
): StudioStageActionConfig {
  return {
    actionId,
    buttonLabel: heading,
    commandPrefix: `pnpm producer ${producerCommand}`,
    description,
    heading,
    requiresRunId,
    routePath,
  };
}

function commandMatchesRunStageAction(
  command: string,
  runId: string,
  commandPrefix: string,
): boolean {
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

function commandMatchesGlobalStageAction(command: string, commandPrefix: string): boolean {
  const tokens = commandTokens(command);
  const prefixTokens = commandTokens(commandPrefix);
  if (!tokensStartWith(tokens, prefixTokens)) {
    return false;
  }
  const trailingTokens = tokens.slice(prefixTokens.length);
  return trailingTokens.every((token) => token === "--json");
}

function commandTokens(command: string): string[] {
  return command.trim().split(/\s+/).filter(Boolean);
}

function tokensStartWith(tokens: readonly string[], prefixTokens: readonly string[]): boolean {
  return prefixTokens.every((token, index) => tokens[index] === token);
}
