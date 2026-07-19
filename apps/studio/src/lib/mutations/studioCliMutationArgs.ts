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

  const specialArgs = await specialCliArgsForAction(actionId, payload);
  if (specialArgs) return specialArgs;
  if (isRunOnlyCliAction(actionId)) return runOnlyCliArgs(actionId, payload);
  throw new Error(`Unsupported Studio CLI mutation action: ${actionId}`);
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
