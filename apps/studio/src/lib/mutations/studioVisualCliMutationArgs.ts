import {
  prepared,
  type StudioCliMutationActionId,
  type StudioPreparedCliArgs,
} from "./studioCliMutationArgsContracts";
import {
  writeTemporaryBinaryInputFile,
  writeTemporaryInputFile,
} from "./studioCliMutationTempFile";
import {
  parseHostedVisualGenerationPayload,
  parseHostedVisualPlanPayload,
  parseLocalVisualGenerationPayload,
  parseVisualActivateRevisionPayload,
  parseVisualDecisionPayload,
  parseVisualImportPayload,
  parseVisualRegenerationPayload,
} from "./studioMutationPayloadContracts";

type StudioVisualCliMutationActionId = Extract<
  StudioCliMutationActionId,
  | "visuals.decide"
  | "visuals.generate-hosted"
  | "visuals.generate-local"
  | "visuals.activate-revision"
  | "visuals.import"
  | "visuals.plan-hosted"
  | "visuals.regenerate"
>;

/**
 * Builds guarded CLI arguments for the requested visual mutation action.
 *
 * @param actionId - The visual mutation action to prepare
 * @param payload - The action payload to validate and convert into CLI arguments
 * @returns Prepared CLI arguments and any required temporary-resource cleanup
 */
export async function visualCliArgsForAction(
  actionId: StudioVisualCliMutationActionId,
  payload: unknown,
): Promise<StudioPreparedCliArgs> {
  if (actionId === "visuals.import") return visualImportCliArgs(payload);
  if (actionId === "visuals.decide") return visualDecisionCliArgs(payload);
  if (actionId === "visuals.regenerate") return visualRegenerationCliArgs(payload);
  if (actionId === "visuals.plan-hosted") return hostedVisualPlanCliArgs(payload);
  if (actionId === "visuals.generate-local") return localVisualGenerationCliArgs(payload);
  if (actionId === "visuals.activate-revision") return visualActivationCliArgs(payload);
  return hostedVisualGenerationCliArgs(payload);
}

async function localVisualGenerationCliArgs(payload: unknown): Promise<StudioPreparedCliArgs> {
  const input = parseLocalVisualGenerationPayload(payload);
  const expectationTemp = await writeVisualExpectationSnapshot(input.expectedActiveRevisions);
  return prepared(
    [
      "visuals",
      "generate-local",
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

async function visualActivationCliArgs(payload: unknown): Promise<StudioPreparedCliArgs> {
  const input = parseVisualActivateRevisionPayload(payload);
  const expectationTemp = await writeVisualExpectationSnapshot(input.expectedActiveRevisions);
  return prepared(
    [
      "visuals",
      "activate-revision",
      "--run",
      input.runId,
      "--scene",
      String(input.sceneIndex),
      "--revision",
      String(input.revision),
      ...visualExpectationArgs(input.expectedManifestDigest, expectationTemp.filePath),
      "--json",
    ],
    expectationTemp.cleanup,
  );
}

/**
 * Builds guarded CLI arguments for planning a hosted visual mutation.
 *
 * @param payload - The untyped hosted visual plan request.
 * @returns Prepared CLI arguments, including temporary expectation-file cleanup when applicable.
 */
async function hostedVisualPlanCliArgs(payload: unknown): Promise<StudioPreparedCliArgs> {
  const input = parseHostedVisualPlanPayload(payload);
  const expectationTemp = input.expectedActiveRevisions
    ? await writeVisualExpectationSnapshot(input.expectedActiveRevisions)
    : null;
  return prepared(
    [
      "visuals",
      "plan-hosted",
      "--run",
      input.runId,
      "--scenes",
      Array.from(new Set(input.sceneIndexes)).join(","),
      "--purpose",
      input.purpose,
      ...(input.reviewedBy ? ["--reviewed-by", input.reviewedBy] : []),
      ...(input.reason ? ["--reason", input.reason] : []),
      ...(input.expectedManifestDigest && expectationTemp
        ? visualExpectationArgs(input.expectedManifestDigest, expectationTemp.filePath)
        : []),
      "--json",
    ],
    expectationTemp?.cleanup,
  );
}

/**
 * Builds guarded CLI arguments for generating a hosted visual.
 *
 * @param payload - The untyped mutation payload containing the run and approval details.
 * @returns Prepared CLI arguments for the hosted visual generation command.
 */
function hostedVisualGenerationCliArgs(payload: unknown): StudioPreparedCliArgs {
  const input = parseHostedVisualGenerationPayload(payload);
  return prepared([
    "visuals",
    "generate-hosted",
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

/**
 * Prepares guarded CLI arguments for importing a visual asset.
 *
 * @param payload - The untyped visual import mutation payload.
 * @returns Prepared CLI arguments and cleanup for the temporary import and expectation files.
 */
async function visualImportCliArgs(payload: unknown): Promise<StudioPreparedCliArgs> {
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
  const expectationTemp = await writeVisualExpectationSnapshot(input.expectedActiveRevisions).catch(
    (error: unknown) => cleanupAfterPreparationFailure(temp.cleanup, error),
  );
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

async function visualDecisionCliArgs(payload: unknown): Promise<StudioPreparedCliArgs> {
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

async function visualRegenerationCliArgs(payload: unknown): Promise<StudioPreparedCliArgs> {
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
