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
  parseVisualDecisionPayload,
  parseVisualImportPayload,
  parseVisualRegenerationPayload,
} from "./studioMutationPayloadContracts";

type StudioVisualCliMutationActionId = Extract<
  StudioCliMutationActionId,
  "visuals.decide" | "visuals.import" | "visuals.regenerate"
>;

/** Builds guarded CLI arguments for visual import, decision, and regeneration mutations. */
export async function visualCliArgsForAction(
  actionId: StudioVisualCliMutationActionId,
  payload: unknown,
): Promise<StudioPreparedCliArgs> {
  if (actionId === "visuals.import") return visualImportCliArgs(payload);
  if (actionId === "visuals.decide") return visualDecisionCliArgs(payload);
  return visualRegenerationCliArgs(payload);
}

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
