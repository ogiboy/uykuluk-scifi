import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { artifactPath } from "../../core/artifacts.js";
import { SafeExitError } from "../../core/errors.js";
import type { RunRecord } from "../../core/state.js";
import { pathExists } from "../../utils/fs.js";
import type { VoiceoverAudioMeta } from "./voiceoverEvidence.js";
import { voiceoverPreparationSchema } from "./voiceoverPreparation.js";

export {
  assertVoiceoverAlignment,
  persistedAlignmentSchema,
} from "./voiceoverAlignmentValidation.js";
export { assertVoiceoverSubtitles } from "./voiceoverSubtitleValidation.js";

/** Verifies that required voiceover artifacts are registered for the run and exist on disk. */
export async function assertVoiceoverArtifacts(
  run: RunRecord,
  requiredPaths: readonly string[],
  resolveArtifact: (relativePath: string) => string = (relativePath) =>
    artifactPath(run.runId, relativePath),
): Promise<void> {
  for (const relativePath of requiredPaths) {
    if (!run.artifacts.includes(relativePath)) {
      throw new SafeExitError(`Voiceover artifact is not registered: ${relativePath}.`);
    }
    if (!(await pathExists(resolveArtifact(relativePath)))) {
      throw new SafeExitError(`Voiceover artifact is missing: ${relativePath}.`);
    }
  }
}

/** Validates the voiceover source and optional preparation evidence against run metadata. */
export async function assertVoiceoverSource(
  run: RunRecord,
  meta: VoiceoverAudioMeta,
  resolveArtifact: (relativePath: string) => string = (relativePath) =>
    artifactPath(run.runId, relativePath),
): Promise<void> {
  const sourceText = await readFile(resolveArtifact(meta.source.path), "utf8");
  if (createHash("sha256").update(sourceText, "utf8").digest("hex") !== meta.source.sha256) {
    throw new SafeExitError("Voiceover source text digest does not match metadata.");
  }
  if (!meta.source.preparation) return;
  for (const relativePath of [meta.source.preparation.path, meta.source.preparation.metadataPath]) {
    if (!run.artifacts.includes(relativePath)) {
      throw new SafeExitError(`Voiceover preparation artifact is not registered: ${relativePath}.`);
    }
    if (!(await pathExists(resolveArtifact(relativePath)))) {
      throw new SafeExitError(`Voiceover preparation artifact is missing: ${relativePath}.`);
    }
  }
  const preparedText = await readFile(resolveArtifact(meta.source.preparation.path), "utf8");
  if (
    createHash("sha256").update(preparedText, "utf8").digest("hex") !==
    meta.source.preparation.sha256
  ) {
    throw new SafeExitError("Prepared voiceover text digest does not match metadata.");
  }
  const preparationText = await readFile(
    resolveArtifact(meta.source.preparation.metadataPath),
    "utf8",
  );
  if (
    createHash("sha256").update(preparationText, "utf8").digest("hex") !==
    meta.source.preparation.metadataSha256
  ) {
    throw new SafeExitError("Voiceover preparation metadata digest does not match voice metadata.");
  }
  const preparation = voiceoverPreparationSchema.parse(JSON.parse(preparationText) as unknown);
  if (
    preparation.runId !== run.runId ||
    preparation.source.sha256 !== meta.source.sha256 ||
    preparation.output.sha256 !== meta.source.preparation.sha256 ||
    preparation.replacements.length !== meta.source.preparation.replacementsApplied
  ) {
    throw new SafeExitError("Voiceover preparation evidence does not match voice metadata.");
  }
}
