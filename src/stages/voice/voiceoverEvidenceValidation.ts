import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { artifactPath } from "../../core/artifacts.js";
import { SafeExitError } from "../../core/errors.js";
import type { RunRecord } from "../../core/state.js";
import { pathExists } from "../../utils/fs.js";
import type { VoiceoverAudioMeta } from "./voiceoverEvidence.js";
import { voiceoverPreparationSchema } from "./voiceoverPreparation.js";

export const persistedAlignmentSchema = z
  .strictObject({
    characters: z.array(z.string()).min(1),
    characterStartTimesSeconds: z.array(z.number().nonnegative()).min(1),
    characterEndTimesSeconds: z.array(z.number().nonnegative()).min(1),
  })
  .superRefine((alignment, context) => {
    const lengths = [
      alignment.characters.length,
      alignment.characterStartTimesSeconds.length,
      alignment.characterEndTimesSeconds.length,
    ];
    if (new Set(lengths).size !== 1) {
      context.addIssue({ code: "custom", message: "Alignment arrays must have equal lengths." });
    }
  });

/**
 * Verifies that required voiceover artifacts are registered for the run and exist on disk.
 *
 * @param requiredPaths - Relative paths of the required voiceover artifacts
 */
export async function assertVoiceoverArtifacts(
  run: RunRecord,
  requiredPaths: readonly string[],
): Promise<void> {
  for (const relativePath of requiredPaths) {
    if (!run.artifacts.includes(relativePath)) {
      throw new SafeExitError(`Voiceover artifact is not registered: ${relativePath}.`);
    }
    if (!(await pathExists(artifactPath(run.runId, relativePath)))) {
      throw new SafeExitError(`Voiceover artifact is missing: ${relativePath}.`);
    }
  }
}

/**
 * Validates the persisted voiceover alignment artifact against its metadata.
 *
 * @param meta - Metadata describing the expected alignment artifact and character count
 */
export async function assertVoiceoverAlignment(
  run: RunRecord,
  meta: VoiceoverAudioMeta,
): Promise<void> {
  if (!meta.alignment) {
    return;
  }
  if (!run.artifacts.includes(meta.alignment.path)) {
    throw new SafeExitError(
      `Voiceover alignment artifact is not registered: ${meta.alignment.path}.`,
    );
  }
  const target = artifactPath(run.runId, meta.alignment.path);
  if (!(await pathExists(target))) {
    throw new SafeExitError(`Voiceover alignment artifact is missing: ${meta.alignment.path}.`);
  }
  const text = await readFile(target, "utf8");
  if (createHash("sha256").update(text, "utf8").digest("hex") !== meta.alignment.sha256) {
    throw new SafeExitError("Voiceover alignment digest does not match metadata.");
  }
  const alignment = persistedAlignmentSchema.parse(JSON.parse(text) as unknown);
  if (alignment.characters.length !== meta.alignment.characterCount) {
    throw new SafeExitError("Voiceover alignment character count does not match metadata.");
  }
}

/**
 * Validates the voiceover source and its optional preparation evidence against the run metadata.
 *
 * @param run - The run containing the voiceover artifacts.
 * @param meta - Metadata describing the expected voiceover source and preparation evidence.
 */
export async function assertVoiceoverSource(
  run: RunRecord,
  meta: VoiceoverAudioMeta,
): Promise<void> {
  const sourceText = await readFile(artifactPath(run.runId, meta.source.path), "utf8");
  if (createHash("sha256").update(sourceText, "utf8").digest("hex") !== meta.source.sha256) {
    throw new SafeExitError("Voiceover source text digest does not match metadata.");
  }
  if (!meta.source.preparation) {
    return;
  }
  for (const relativePath of [meta.source.preparation.path, meta.source.preparation.metadataPath]) {
    if (!run.artifacts.includes(relativePath)) {
      throw new SafeExitError(`Voiceover preparation artifact is not registered: ${relativePath}.`);
    }
    if (!(await pathExists(artifactPath(run.runId, relativePath)))) {
      throw new SafeExitError(`Voiceover preparation artifact is missing: ${relativePath}.`);
    }
  }
  const preparedText = await readFile(
    artifactPath(run.runId, meta.source.preparation.path),
    "utf8",
  );
  if (
    createHash("sha256").update(preparedText, "utf8").digest("hex") !==
    meta.source.preparation.sha256
  ) {
    throw new SafeExitError("Prepared voiceover text digest does not match metadata.");
  }
  const preparationText = await readFile(
    artifactPath(run.runId, meta.source.preparation.metadataPath),
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
