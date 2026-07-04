import type { StudioMutationActionId } from "../../../../src/studio/actionServiceMetadata";
import {
  parseChannelHandoffDecisionPayload,
  parseIdeaApprovalPayload,
  parseRenderDecisionPayload,
  parseRunOnlyPayload,
  parseScriptApprovalPayload,
} from "./studioMutationPayloadContracts";

export type StudioCliMutationActionId = Exclude<
  StudioMutationActionId,
  "publish.schedule" | "upload.private"
>;

type RunOnlyCliActionId = Exclude<
  StudioCliMutationActionId,
  "channel-handoff.decide" | "idea.approve" | "render.decide" | "script.approve"
>;

/**
 * Builds whitelisted producer CLI arguments for one guarded Studio mutation.
 *
 * @param actionId - The Studio mutation action identifier.
 * @param payload - The JSON request payload to parse for the action.
 * @returns Safe producer CLI args.
 */
export function cliArgsForAction(actionId: StudioCliMutationActionId, payload: unknown): string[] {
  if (actionId === "idea.approve") {
    const input = parseIdeaApprovalPayload(payload);
    return ["approve", "idea", "--run", input.runId, "--idea", input.ideaId, "--json"];
  }
  if (actionId === "script.approve") {
    const input = parseScriptApprovalPayload(payload);
    return [
      "approve",
      "script",
      "--run",
      input.runId,
      ...(input.acknowledgeWarnings ? ["--acknowledge-warnings"] : []),
      "--json",
    ];
  }
  if (actionId === "render.decide") {
    const input = parseRenderDecisionPayload(payload);
    return [
      "decide",
      "render",
      "--run",
      input.runId,
      "--decision",
      input.decision,
      "--notes",
      input.notes,
      "--reviewed-by",
      input.reviewedBy,
      "--json",
    ];
  }
  if (actionId === "channel-handoff.decide") {
    const input = parseChannelHandoffDecisionPayload(payload);
    return [
      "decide",
      "channel-handoff",
      "--run",
      input.runId,
      "--decision",
      input.decision,
      ...(input.thumbnailCandidateId ? ["--thumbnail-candidate", input.thumbnailCandidateId] : []),
      "--notes",
      input.notes,
      "--reviewed-by",
      input.reviewedBy,
      "--json",
    ];
  }
  return runOnlyCliArgs(actionId, payload);
}

function runOnlyCliArgs(actionId: RunOnlyCliActionId, payload: unknown): string[] {
  const input = parseRunOnlyPayload(payload);
  return [...runOnlyCliCommand[actionId], "--run", input.runId, "--json"];
}

const runOnlyCliCommand: Record<RunOnlyCliActionId, readonly string[]> = {
  "channel-handoff.run": ["channel-handoff"],
  "cost.approve": ["approve", "cost"],
  "estimate.run": ["estimate"],
  "evidence.run": ["evidence"],
  "package.run": ["package"],
  "readiness.run": ["readiness"],
  "render.approve": ["approve", "render"],
  "render.review": ["review", "render"],
  "render.run": ["render"],
  "render-plan.review": ["review", "render-plan"],
  "render-plan.run": ["render-plan"],
  "review-bundle.run": ["review-bundle"],
  "script.review": ["review", "script"],
  "script.run": ["script"],
  "voice.review": ["review", "voice"],
  "voice.run": ["voice"],
};
