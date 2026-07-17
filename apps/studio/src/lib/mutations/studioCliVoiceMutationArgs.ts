import {
  prepared,
  type StudioCliMutationActionId,
  type StudioPreparedCliArgs,
} from "./studioCliMutationArgsContracts";
import {
  parseVoicePreviewPayload,
  parseVoiceReselectionPayload,
  parseVoiceRunPayload,
  parseVoiceSelectionPayload,
} from "./studioMutationPayloadContracts";

type StudioVoiceCliMutationActionId = Extract<
  StudioCliMutationActionId,
  "voice.preview" | "voice.reselect" | "voice.run" | "voice.select"
>;

export function voiceCliArgsForAction(
  actionId: StudioVoiceCliMutationActionId,
  payload: unknown,
): StudioPreparedCliArgs {
  switch (actionId) {
    case "voice.preview":
      return voicePreviewCliArgs(payload);
    case "voice.select":
      return voiceSelectionCliArgs(payload);
    case "voice.reselect":
      return voiceReselectionCliArgs(payload);
    case "voice.run":
      return voiceRunCliArgs(payload);
  }
}

function voicePreviewCliArgs(payload: unknown): StudioPreparedCliArgs {
  const input = parseVoicePreviewPayload(payload);
  return prepared(["voice-preview", "--run", input.runId, "--voice", input.voiceId, "--json"]);
}

function voiceSelectionCliArgs(payload: unknown): StudioPreparedCliArgs {
  const input = parseVoiceSelectionPayload(payload);
  return prepared([
    "voice-select",
    "--run",
    input.runId,
    "--voice",
    input.voiceId,
    "--reviewed-by",
    input.reviewedBy,
    "--notes",
    input.notes,
    ...(input.confirmProductionRights ? ["--confirm-production-rights"] : []),
    "--json",
  ]);
}

function voiceReselectionCliArgs(payload: unknown): StudioPreparedCliArgs {
  const input = parseVoiceReselectionPayload(payload);
  return prepared([
    "voice-reselect",
    "--run",
    input.runId,
    "--reviewed-by",
    input.reviewedBy,
    "--reason",
    input.reason,
    "--json",
  ]);
}

function voiceRunCliArgs(payload: unknown): StudioPreparedCliArgs {
  const input = parseVoiceRunPayload(payload);
  if (!("executionMode" in input)) return prepared(["voice", "--run", input.runId, "--json"]);
  return prepared([
    "voice",
    "--run",
    input.runId,
    "--binding-digest",
    input.bindingDigest,
    "--quote-digest",
    input.quoteDigest,
    "--approval-id",
    input.approvalId,
    "--confirm-paid-operation",
    "--json",
  ]);
}
