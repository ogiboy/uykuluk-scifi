import {
  prepared,
  runOnlyCliCommand,
  type RunOnlyCliActionId,
  type StudioCliMutationActionId,
  type StudioPreparedCliArgs,
} from "./studioCliMutationArgsContracts";
import { writeTemporaryInputFile } from "./studioCliMutationTempFile";
import { isStaticCliAction, staticCliCommand } from "./studioCliStaticCommands";
import {
  parseAnalyticsImportPayload,
  parseChannelHandoffDecisionPayload,
  parseEmptyPayload,
  parseIdeaApprovalPayload,
  parseLocalModelCandidateEvalPayload,
  parsePackageArtifactRevisionPayload,
  parseRenderDecisionPayload,
  parseRunOnlyPayload,
  parseScriptApprovalPayload,
  parseScriptRevisionPayload,
  parseVoicePreviewPayload,
  parseVoiceReselectionPayload,
  parseVoiceRunPayload,
  parseVoiceSelectionPayload,
} from "./studioMutationPayloadContracts";

export { studioCliMutationActionIds } from "./studioCliMutationArgsContracts";
export type {
  StudioCliMutationActionId,
  StudioPreparedCliArgs,
} from "./studioCliMutationArgsContracts";

/**
 * Builds whitelisted producer CLI arguments for one guarded Studio mutation.
 *
 * @param actionId - The Studio mutation action identifier.
 * @param payload - The JSON request payload to parse for the action.
 * @returns Safe producer CLI args.
 */
export async function cliArgsForAction(
  actionId: StudioCliMutationActionId,
  payload: unknown,
): Promise<StudioPreparedCliArgs> {
  if (isStaticCliAction(actionId)) {
    parseEmptyPayload(payload);
    return prepared([...staticCliCommand(actionId), "--json"]);
  }
  if (actionId === "analytics.import") {
    const input = parseAnalyticsImportPayload(payload);
    const temp = await writeTemporaryInputFile(
      input.content,
      "uykuluk-studio-analytics-",
      analyticsImportTempFileName(input.sourceFileName, input.format),
    );
    return prepared(["analytics", "import", "--file", temp.filePath, "--json"], temp.cleanup);
  }
  if (actionId === "idea.approve") {
    const input = parseIdeaApprovalPayload(payload);
    return prepared(["approve", "idea", "--run", input.runId, "--idea", input.ideaId, "--json"]);
  }
  if (actionId === "model-eval-candidates.run") {
    const input = parseLocalModelCandidateEvalPayload(payload);
    return prepared([
      "eval",
      "local-model-candidates",
      ...input.candidates.flatMap((candidate) => ["--candidate", candidate]),
      ...(input.includeLocalGguf ? ["--include-local-gguf"] : []),
      "--json",
    ]);
  }
  if (actionId === "script.approve") {
    const input = parseScriptApprovalPayload(payload);
    return prepared([
      "approve",
      "script",
      "--run",
      input.runId,
      ...(input.acknowledgeWarnings ? ["--acknowledge-warnings"] : []),
      "--json",
    ]);
  }
  if (actionId === "script.revise") {
    const input = parseScriptRevisionPayload(payload);
    const temp = await writeTemporaryInputFile(
      input.content,
      "uykuluk-studio-revision-",
      "revision-content.txt",
    );
    return prepared(
      [
        "revise",
        "script",
        "--run",
        input.runId,
        "--file",
        temp.filePath,
        "--reason",
        input.reason,
        "--editor",
        input.editor,
        "--json",
      ],
      temp.cleanup,
    );
  }
  if (actionId === "package-artifact.revise") {
    const input = parsePackageArtifactRevisionPayload(payload);
    const temp = await writeTemporaryInputFile(
      input.content,
      "uykuluk-studio-revision-",
      "revision-content.txt",
    );
    return prepared(
      [
        "revise",
        "package-artifact",
        "--run",
        input.runId,
        "--artifact",
        input.artifactKey,
        "--file",
        temp.filePath,
        "--reason",
        input.reason,
        "--editor",
        input.editor,
        "--json",
      ],
      temp.cleanup,
    );
  }
  if (actionId === "render.decide") {
    const input = parseRenderDecisionPayload(payload);
    return prepared([
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
    ]);
  }
  if (actionId === "channel-handoff.decide") {
    const input = parseChannelHandoffDecisionPayload(payload);
    return prepared([
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
    ]);
  }
  if (actionId === "voice.preview") {
    const input = parseVoicePreviewPayload(payload);
    return prepared(["voice-preview", "--run", input.runId, "--voice", input.voiceId, "--json"]);
  }
  if (actionId === "voice.select") {
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
  if (actionId === "voice.reselect") {
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
  if (actionId === "voice.run") {
    const input = parseVoiceRunPayload(payload);
    if (!("executionMode" in input)) {
      return prepared(["voice", "--run", input.runId, "--json"]);
    }
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
  return runOnlyCliArgs(actionId, payload);
}

function runOnlyCliArgs(actionId: RunOnlyCliActionId, payload: unknown): StudioPreparedCliArgs {
  const input = parseRunOnlyPayload(payload);
  return prepared([...runOnlyCliCommand[actionId], "--run", input.runId, "--json"]);
}

function analyticsImportTempFileName(sourceFileName: string, format: "csv" | "json"): string {
  const extension = `.${format}`;
  return sourceFileName.toLowerCase().endsWith(extension)
    ? sourceFileName
    : `${sourceFileName}${extension}`;
}
