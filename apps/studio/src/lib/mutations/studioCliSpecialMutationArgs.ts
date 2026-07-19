import {
  prepared,
  type StudioCliMutationActionId,
  type StudioPreparedCliArgs,
} from "./studioCliMutationArgsContracts";
import { writeTemporaryInputFile } from "./studioCliMutationTempFile";
import { voiceCliArgsForAction } from "./studioCliVoiceMutationArgs";
import {
  parseAnalyticsImportPayload,
  parseChannelHandoffDecisionPayload,
  parseElevenLabsDiagnosticSmokePayload,
  parseEpisodeCreationPayload,
  parseIdeaApprovalPayload,
  parseLocalModelCandidateEvalPayload,
  parseLocalModelExecutePayload,
  parseLocalModelPreparePayload,
  parsePackageArtifactRevisionPayload,
  parsePromptProfileSavePayload,
  parseRenderDecisionPayload,
  parseScriptApprovalPayload,
  parseScriptRevisionPayload,
  parseSettingsSavePayload,
} from "./studioMutationPayloadContracts";

/**
 * Maps a studio mutation action and payload to prepared CLI arguments.
 *
 * @param actionId - The mutation action to prepare
 * @param payload - The action payload to parse and pass to the CLI
 * @returns Prepared CLI arguments for supported actions, or `undefined` for unrecognized actions
 */
export async function specialCliArgsForAction(
  actionId: StudioCliMutationActionId,
  payload: unknown,
): Promise<StudioPreparedCliArgs | undefined> {
  switch (actionId) {
    case "analytics.import":
      return analyticsImportCliArgs(payload);
    case "settings.save":
      return fileBackedCliArgs(
        payload,
        parseSettingsSavePayload,
        "uykuluk-studio-settings-",
        "settings-save.json",
        ["settings", "save"],
      );
    case "promptProfiles.save":
      return fileBackedCliArgs(
        payload,
        parsePromptProfileSavePayload,
        "uykuluk-studio-prompt-profile-",
        "prompt-profile-save.json",
        ["prompt-profiles", "save"],
      );
    case "episodes.create":
      return fileBackedCliArgs(
        payload,
        parseEpisodeCreationPayload,
        "uykuluk-studio-episode-",
        "episode-create.json",
        ["episodes", "create"],
      );
    case "providers.elevenlabs.smoke":
      return fileBackedCliArgs(
        payload,
        parseElevenLabsDiagnosticSmokePayload,
        "uykuluk-studio-elevenlabs-smoke-",
        "elevenlabs-smoke.json",
        ["provider-smoke", "elevenlabs"],
      );
    case "idea.approve":
      return ideaApprovalCliArgs(payload);
    case "model-eval-candidates.run":
      return localModelCandidateEvalCliArgs(payload);
    case "localModels.prepare":
      return fileBackedCliArgs(
        payload,
        parseLocalModelPreparePayload,
        "uykuluk-studio-local-model-",
        "local-model-prepare.json",
        ["local-model", "prepare"],
      );
    case "localModels.execute":
      return fileBackedCliArgs(
        payload,
        parseLocalModelExecutePayload,
        "uykuluk-studio-local-model-",
        "local-model-execute.json",
        ["local-model", "execute"],
      );
    case "script.approve":
      return scriptApprovalCliArgs(payload);
    case "script.revise":
      return scriptRevisionCliArgs(payload);
    case "package-artifact.revise":
      return packageArtifactRevisionCliArgs(payload);
    case "render.decide":
      return renderDecisionCliArgs(payload);
    case "channel-handoff.decide":
      return channelHandoffDecisionCliArgs(payload);
    case "voice.preview":
    case "voice.select":
    case "voice.reselect":
    case "voice.run":
      return voiceCliArgsForAction(actionId, payload);
    default:
      return undefined;
  }
}

async function analyticsImportCliArgs(payload: unknown): Promise<StudioPreparedCliArgs> {
  const input = parseAnalyticsImportPayload(payload);
  const temp = await writeTemporaryInputFile(
    input.content,
    "uykuluk-studio-analytics-",
    analyticsImportTempFileName(input.sourceFileName, input.format),
  );
  return prepared(["analytics", "import", "--file", temp.filePath, "--json"], temp.cleanup);
}

async function fileBackedCliArgs<T>(
  payload: unknown,
  parse: (value: unknown) => T,
  temporaryFilePrefix: string,
  fileName: string,
  command: readonly string[],
): Promise<StudioPreparedCliArgs> {
  const temp = await writeTemporaryInputFile(
    JSON.stringify(parse(payload)),
    temporaryFilePrefix,
    fileName,
  );
  return prepared([...command, "--file", temp.filePath, "--json"], temp.cleanup);
}

function ideaApprovalCliArgs(payload: unknown): StudioPreparedCliArgs {
  const input = parseIdeaApprovalPayload(payload);
  return prepared(["approve", "idea", "--run", input.runId, "--idea", input.ideaId, "--json"]);
}

function localModelCandidateEvalCliArgs(payload: unknown): StudioPreparedCliArgs {
  const input = parseLocalModelCandidateEvalPayload(payload);
  return prepared([
    "eval",
    "local-model-candidates",
    ...input.candidates.flatMap((candidate) => ["--candidate", candidate]),
    ...(input.includeLocalGguf ? ["--include-local-gguf"] : []),
    "--json",
  ]);
}

function scriptApprovalCliArgs(payload: unknown): StudioPreparedCliArgs {
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

async function scriptRevisionCliArgs(payload: unknown): Promise<StudioPreparedCliArgs> {
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

async function packageArtifactRevisionCliArgs(payload: unknown): Promise<StudioPreparedCliArgs> {
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

function renderDecisionCliArgs(payload: unknown): StudioPreparedCliArgs {
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

function channelHandoffDecisionCliArgs(payload: unknown): StudioPreparedCliArgs {
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

function analyticsImportTempFileName(sourceFileName: string, format: "csv" | "json"): string {
  const extension = `.${format}`;
  return sourceFileName.toLowerCase().endsWith(extension)
    ? sourceFileName
    : `${sourceFileName}${extension}`;
}
