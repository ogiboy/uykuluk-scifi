import {
  prepared,
  runOnlyCliCommand,
  type RunOnlyCliActionId,
  type StudioCliMutationActionId,
  type StudioPreparedCliArgs,
} from "./studioCliMutationArgsContracts";
import {
  writeTemporaryBinaryInputFile,
  writeTemporaryInputFile,
} from "./studioCliMutationTempFile";
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
  parseVisualDecisionPayload,
  parseVisualImportPayload,
  parseVisualRegenerationPayload,
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
  switch (actionId) {
    case "analytics.import": {
      const input = parseAnalyticsImportPayload(payload);
      const temp = await writeTemporaryInputFile(
        input.content,
        "uykuluk-studio-analytics-",
        analyticsImportTempFileName(input.sourceFileName, input.format),
      );
      return prepared(["analytics", "import", "--file", temp.filePath, "--json"], temp.cleanup);
    }
    case "idea.approve": {
      const input = parseIdeaApprovalPayload(payload);
      return prepared(["approve", "idea", "--run", input.runId, "--idea", input.ideaId, "--json"]);
    }
    case "model-eval-candidates.run": {
      const input = parseLocalModelCandidateEvalPayload(payload);
      return prepared([
        "eval",
        "local-model-candidates",
        ...input.candidates.flatMap((candidate) => ["--candidate", candidate]),
        ...(input.includeLocalGguf ? ["--include-local-gguf"] : []),
        "--json",
      ]);
    }
    case "script.approve": {
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
    case "script.revise": {
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
    case "package-artifact.revise": {
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
    case "render.decide": {
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
    case "channel-handoff.decide": {
      const input = parseChannelHandoffDecisionPayload(payload);
      return prepared([
        "decide",
        "channel-handoff",
        "--run",
        input.runId,
        "--decision",
        input.decision,
        ...(input.thumbnailCandidateId
          ? ["--thumbnail-candidate", input.thumbnailCandidateId]
          : []),
        "--notes",
        input.notes,
        "--reviewed-by",
        input.reviewedBy,
        "--json",
      ]);
    }
    case "visuals.import": {
      const input = parseVisualImportPayload(payload);
      const content = Buffer.from(input.contentBase64, "base64");
      if (content.byteLength > 25 * 1024 * 1024) {
        throw new Error("Visual imports must not exceed 25 MiB.");
      }
      const temp = await writeTemporaryBinaryInputFile(
        content,
        "uykuluk-studio-visual-",
        input.sourceFileName,
      );
      const expectationTemp = await writeVisualExpectationSnapshot(
        input.expectedActiveRevisions,
      ).catch((error: unknown) => cleanupAfterPreparationFailure(temp.cleanup, error));
      return prepared(
        [
          "visuals",
          "import",
          "--run",
          input.runId,
          "--scene",
          String(input.sceneIndex),
          "--file",
          temp.filePath,
          ...visualExpectationArgs(input.expectedManifestDigest, expectationTemp.filePath),
          "--json",
        ],
        combineCleanups(temp.cleanup, expectationTemp.cleanup),
      );
    }
    case "visuals.decide": {
      const input = parseVisualDecisionPayload(payload);
      const expectationTemp = await writeVisualExpectationSnapshot(input.expectedActiveRevisions);
      return prepared(
        [
          "visuals",
          "decide",
          "--run",
          input.runId,
          "--scenes",
          Array.from(new Set(input.sceneIndexes)).join(","),
          "--decision",
          input.status,
          "--reviewed-by",
          input.reviewedBy,
          "--notes",
          input.notes,
          ...visualExpectationArgs(input.expectedManifestDigest, expectationTemp.filePath),
          "--json",
        ],
        expectationTemp.cleanup,
      );
    }
    case "visuals.regenerate": {
      const input = parseVisualRegenerationPayload(payload);
      const expectationTemp = await writeVisualExpectationSnapshot(input.expectedActiveRevisions);
      return prepared(
        [
          "visuals",
          "regenerate",
          "--run",
          input.runId,
          "--scenes",
          Array.from(new Set(input.sceneIndexes)).join(","),
          ...visualExpectationArgs(input.expectedManifestDigest, expectationTemp.filePath),
          "--json",
        ],
        expectationTemp.cleanup,
      );
    }
    case "voice.preview": {
      const input = parseVoicePreviewPayload(payload);
      return prepared(["voice-preview", "--run", input.runId, "--voice", input.voiceId, "--json"]);
    }
    case "voice.select": {
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
    case "voice.reselect": {
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
    case "voice.run": {
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
    default:
      return runOnlyCliArgs(actionId, payload);
  }
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

function writeVisualExpectationSnapshot(
  expectedActiveRevisions: readonly Readonly<{ activeRevision: number; sceneIndex: number }>[],
) {
  return writeTemporaryInputFile(
    `${JSON.stringify(expectedActiveRevisions, null, 2)}\n`,
    "uykuluk-studio-visual-expectation-",
    "active-revisions.json",
  );
}

function visualExpectationArgs(
  expectedManifestDigest: string,
  expectedActiveRevisionsFile: string,
): string[] {
  return [
    "--expected-manifest-digest",
    expectedManifestDigest,
    "--expected-active-revisions-file",
    expectedActiveRevisionsFile,
  ];
}

function combineCleanups(...cleanups: readonly (() => Promise<void>)[]): () => Promise<void> {
  return async () => {
    const failures: unknown[] = [];
    for (const cleanup of cleanups) {
      try {
        await cleanup();
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length === 1) throw failures[0];
    if (failures.length > 1) {
      throw new AggregateError(failures, "Multiple Studio temporary input cleanups failed.");
    }
  };
}

async function cleanupAfterPreparationFailure(
  cleanup: () => Promise<void>,
  preparationError: unknown,
): Promise<never> {
  try {
    await cleanup();
  } catch (cleanupError) {
    throw new AggregateError(
      [preparationError, cleanupError],
      "Studio mutation preparation and temporary input cleanup both failed.",
    );
  }
  throw preparationError;
}
