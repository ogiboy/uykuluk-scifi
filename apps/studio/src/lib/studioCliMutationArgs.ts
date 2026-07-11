import type { StudioMutationActionId } from "../../../../src/studio/actionServiceMetadata";
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
} from "./studioMutationPayloadContracts";

export const studioCliMutationActionIds = [
  "analytics.import",
  "analytics.report",
  "channel-handoff.decide",
  "channel-handoff.run",
  "cost.approve",
  "doctor.run",
  "estimate.run",
  "evidence.run",
  "idea.approve",
  "ideas.run",
  "model-eval-candidates.run",
  "model-eval.run",
  "package.run",
  "package-artifact.revise",
  "readiness.run",
  "render.approve",
  "render.decide",
  "render.review",
  "render.run",
  "render-plan.review",
  "render-plan.run",
  "review-bundle.run",
  "script.approve",
  "script.review",
  "script.revise",
  "script.run",
  "voice.review",
  "voice.run",
] as const satisfies readonly Exclude<
  StudioMutationActionId,
  "publish.schedule" | "upload.private"
>[];

export type StudioCliMutationActionId = (typeof studioCliMutationActionIds)[number];

type RunOnlyCliActionId = Exclude<
  StudioCliMutationActionId,
  | "channel-handoff.decide"
  | "analytics.import"
  | "analytics.report"
  | "doctor.run"
  | "idea.approve"
  | "ideas.run"
  | "model-eval.run"
  | "model-eval-candidates.run"
  | "package-artifact.revise"
  | "render.decide"
  | "script.approve"
  | "script.revise"
>;

export type StudioPreparedCliArgs = Readonly<{
  args: readonly string[];
  cleanup: () => Promise<void>;
}>;

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
  return runOnlyCliArgs(actionId, payload);
}

function runOnlyCliArgs(actionId: RunOnlyCliActionId, payload: unknown): StudioPreparedCliArgs {
  const input = parseRunOnlyPayload(payload);
  return prepared([...runOnlyCliCommand[actionId], "--run", input.runId, "--json"]);
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

function prepared(
  args: readonly string[],
  cleanup: () => Promise<void> = async () => {},
): StudioPreparedCliArgs {
  return { args, cleanup };
}

function analyticsImportTempFileName(sourceFileName: string, format: "csv" | "json"): string {
  const extension = `.${format}`;
  return sourceFileName.toLowerCase().endsWith(extension)
    ? sourceFileName
    : `${sourceFileName}${extension}`;
}
