import {
  prepared,
  runOnlyCliCommand,
  type RunOnlyCliActionId,
  type StudioCliMutationActionId,
  type StudioPreparedCliArgs,
} from "./studioCliMutationArgsContracts";
import { specialCliArgsForAction } from "./studioCliSpecialMutationArgs";
import { isStaticCliAction, staticCliCommand } from "./studioCliStaticCommands";
import { parseEmptyPayload, parseRunOnlyPayload } from "./studioMutationPayloadContracts";
import { soundtrackCliArgsForAction } from "./studioSoundtrackCliMutationArgs";
import { visualCliArgsForAction } from "./studioVisualCliMutationArgs";

export { studioCliMutationActionIds } from "./studioCliMutationArgsContracts";
export type {
  StudioCliMutationActionId,
  StudioPreparedCliArgs,
} from "./studioCliMutationArgsContracts";

/** Builds whitelisted producer CLI arguments for one guarded Studio mutation. */
export async function cliArgsForAction(
  actionId: StudioCliMutationActionId,
  payload: unknown,
): Promise<StudioPreparedCliArgs> {
  if (isStaticCliAction(actionId)) {
    parseEmptyPayload(payload);
    return prepared([...staticCliCommand(actionId), "--json"]);
  }
  if (isVisualCliAction(actionId)) return visualCliArgsForAction(actionId, payload);
  if (isSoundtrackCliAction(actionId)) return soundtrackCliArgsForAction(actionId, payload);

  const specialArgs = await specialCliArgsForAction(actionId, payload);
  if (specialArgs) return specialArgs;
  if (isRunOnlyCliAction(actionId)) return runOnlyCliArgs(actionId, payload);
  throw new Error(`Unsupported Studio CLI mutation action: ${actionId}`);
}

function isSoundtrackCliAction(
  actionId: StudioCliMutationActionId,
): actionId is SoundtrackCliActionId {
  return [
    "soundtrack.prepare",
    "soundtrack.import",
    "soundtrack.configure",
    "soundtrack.analyze",
    "soundtrack.decide",
  ].includes(actionId as SoundtrackCliActionId);
}

/**
 * Identifies mutation actions handled by the visual CLI workflow.
 *
 * @param actionId - The Studio mutation action to classify
 * @returns `true` if the action is a visual CLI action, `false` otherwise
 */
function isVisualCliAction(actionId: StudioCliMutationActionId): actionId is VisualCliActionId {
  return [
    "visuals.import",
    "visuals.decide",
    "visuals.generate-hosted",
    "visuals.generate-local",
    "visuals.activate-revision",
    "visuals.plan-hosted",
    "visuals.regenerate",
  ].includes(actionId as VisualCliActionId);
}

function runOnlyCliArgs(actionId: RunOnlyCliActionId, payload: unknown): StudioPreparedCliArgs {
  const input = parseRunOnlyPayload(payload);
  return prepared([...runOnlyCliCommand[actionId], "--run", input.runId, "--json"]);
}

function isRunOnlyCliAction(actionId: StudioCliMutationActionId): actionId is RunOnlyCliActionId {
  return actionId in runOnlyCliCommand;
}

type VisualCliActionId = Extract<
  StudioCliMutationActionId,
  | "visuals.import"
  | "visuals.decide"
  | "visuals.generate-hosted"
  | "visuals.generate-local"
  | "visuals.activate-revision"
  | "visuals.plan-hosted"
  | "visuals.regenerate"
>;

type SoundtrackCliActionId = Extract<
  StudioCliMutationActionId,
  | "soundtrack.prepare"
  | "soundtrack.import"
  | "soundtrack.configure"
  | "soundtrack.analyze"
  | "soundtrack.decide"
>;
