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
  parseSoundtrackAnalyzePayload,
  parseSoundtrackConfigurePayload,
  parseSoundtrackDecisionPayload,
  parseSoundtrackImportPayload,
  parseSoundtrackPreparePayload,
} from "./studioMutationPayloadContracts";

type SoundtrackActionId = Extract<
  StudioCliMutationActionId,
  | "soundtrack.prepare"
  | "soundtrack.import"
  | "soundtrack.configure"
  | "soundtrack.analyze"
  | "soundtrack.decide"
>;

/** Builds whitelisted, expectation-bound CLI arguments for local soundtrack mutations. */
export async function soundtrackCliArgsForAction(
  actionId: SoundtrackActionId,
  payload: unknown,
): Promise<StudioPreparedCliArgs> {
  if (actionId === "soundtrack.prepare") {
    const input = parseSoundtrackPreparePayload(payload);
    return prepared(["soundtrack", "prepare", "--run", input.runId, "--json"]);
  }
  if (actionId === "soundtrack.import") return soundtrackImportCliArgs(payload);
  if (actionId === "soundtrack.configure") return soundtrackConfigureCliArgs(payload);
  if (actionId === "soundtrack.analyze") {
    const input = parseSoundtrackAnalyzePayload(payload);
    return prepared([
      "soundtrack",
      "analyze",
      "--run",
      input.runId,
      ...expectationArgs(input),
      "--json",
    ]);
  }
  const input = parseSoundtrackDecisionPayload(payload);
  return prepared([
    "soundtrack",
    "decide",
    "--run",
    input.runId,
    "--decision",
    input.status,
    "--reviewed-by",
    input.reviewedBy,
    "--notes",
    input.notes,
    ...expectationArgs(input),
    "--json",
  ]);
}

async function soundtrackImportCliArgs(payload: unknown): Promise<StudioPreparedCliArgs> {
  const input = parseSoundtrackImportPayload(payload);
  const content = Buffer.from(input.contentBase64, "base64");
  if (content.byteLength === 0 || content.byteLength > 50 * 1024 * 1024)
    throw new Error("Soundtrack imports must be between 1 byte and 50 MiB.");
  const audio = await writeTemporaryBinaryInputFile(
    content,
    "uykuluk-studio-soundtrack-",
    input.sourceFileName,
  );
  const provenance = await writeTemporaryInputFile(
    `${JSON.stringify(input.provenance)}\n`,
    "uykuluk-studio-soundtrack-provenance-",
    "provenance.json",
  ).catch((error: unknown) => cleanupAfterFailure(audio.cleanup, error));
  return prepared(
    [
      "soundtrack",
      "import",
      "--run",
      input.runId,
      "--asset",
      input.assetId,
      "--role",
      input.role,
      "--file",
      audio.filePath,
      "--provenance-file",
      provenance.filePath,
      ...expectationArgs(input),
      "--json",
    ],
    combineCleanups(audio.cleanup, provenance.cleanup),
  );
}

async function soundtrackConfigureCliArgs(payload: unknown): Promise<StudioPreparedCliArgs> {
  const input = parseSoundtrackConfigurePayload(payload);
  const config = await writeTemporaryInputFile(
    `${JSON.stringify({ music: input.music, sfx: input.sfx })}\n`,
    "uykuluk-studio-soundtrack-config-",
    "mix.json",
  );
  return prepared(
    [
      "soundtrack",
      "configure",
      "--run",
      input.runId,
      "--file",
      config.filePath,
      ...expectationArgs(input),
      "--json",
    ],
    config.cleanup,
  );
}

function expectationArgs(
  input: Readonly<{ expectedManifestDigest: string; expectedRevision: number }>,
): string[] {
  return [
    "--expected-manifest-digest",
    input.expectedManifestDigest,
    "--expected-revision",
    String(input.expectedRevision),
  ];
}

function combineCleanups(...cleanups: readonly (() => Promise<void>)[]): () => Promise<void> {
  return async () => {
    for (const cleanup of cleanups) await cleanup();
  };
}

async function cleanupAfterFailure(cleanup: () => Promise<void>, error: unknown): Promise<never> {
  try {
    await cleanup();
  } catch (cleanupError) {
    throw new AggregateError(
      [error, cleanupError],
      "Soundtrack temporary input preparation and cleanup failed.",
    );
  }
  throw error;
}
