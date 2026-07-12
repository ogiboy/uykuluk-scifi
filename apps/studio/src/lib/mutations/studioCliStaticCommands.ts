import type { StudioCliMutationActionId } from "./studioCliMutationArgs";

export type StaticCliActionId = Extract<
  StudioCliMutationActionId,
  "analytics.report" | "doctor.run" | "ideas.run" | "model-eval.run"
>;

const commands: Record<StaticCliActionId, readonly string[]> = {
  "analytics.report": ["analytics", "report"],
  "doctor.run": ["doctor"],
  "ideas.run": ["ideas"],
  "model-eval.run": ["eval", "local-model"],
};

export function isStaticCliAction(
  actionId: StudioCliMutationActionId,
): actionId is StaticCliActionId {
  return actionId in commands;
}

export function staticCliCommand(actionId: StaticCliActionId): readonly string[] {
  return commands[actionId];
}
