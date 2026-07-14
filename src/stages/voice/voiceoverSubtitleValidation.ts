import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { artifactPath } from "../../core/artifacts.js";
import { SafeExitError } from "../../core/errors.js";
import type { RunRecord } from "../../core/state.js";
import { pathExists } from "../../utils/fs.js";
import { persistedAlignmentSchema } from "./voiceoverAlignmentValidation.js";
import type { VoiceoverAudioMeta } from "./voiceoverEvidence.js";
import { voiceoverPreparationV2Schema } from "./voiceoverPreparation.js";
import {
  alignedSubtitleMetadataPath,
  inspectVoiceSubtitleSrt,
  voiceSubtitleMetadataSchema,
  type ActiveVoiceSubtitleDescriptor,
} from "./voiceoverSubtitles.js";

/** Validates the active subtitle descriptor and all bytes bound by its metadata. */
export async function assertVoiceoverSubtitles(
  run: Pick<RunRecord, "artifacts" | "runId">,
  meta: Extract<VoiceoverAudioMeta, { schemaVersion: 2 }>,
  audioDigest: string,
  resolveArtifact: (relativePath: string) => string = (relativePath) =>
    artifactPath(run.runId, relativePath),
): Promise<ActiveVoiceSubtitleDescriptor> {
  const descriptor = meta.subtitle;
  if (descriptor.metadataPath !== alignedSubtitleMetadataPath) {
    throw new SafeExitError(
      "Current voice subtitle evidence requires canonical subtitle metadata.",
    );
  }
  for (const relativePath of [descriptor.path, descriptor.metadataPath]) {
    if (!run.artifacts.includes(relativePath)) {
      throw new SafeExitError(`Voice subtitle artifact is not registered: ${relativePath}.`);
    }
    if (!(await pathExists(resolveArtifact(relativePath)))) {
      throw new SafeExitError(`Voice subtitle artifact is missing: ${relativePath}.`);
    }
  }
  const subtitleText = await readFile(resolveArtifact(descriptor.path), "utf8");
  const metadataText = await readFile(resolveArtifact(descriptor.metadataPath), "utf8");
  if (
    createHash("sha256").update(subtitleText, "utf8").digest("hex") !== descriptor.sha256 ||
    createHash("sha256").update(metadataText, "utf8").digest("hex") !== descriptor.metadataSha256
  ) {
    throw new SafeExitError("Voice subtitle bytes do not match voice metadata.");
  }
  const metadata = voiceSubtitleMetadataSchema.parse(JSON.parse(metadataText) as unknown);
  const sourcePreparation = meta.source.preparation;
  if (!sourcePreparation) {
    throw new SafeExitError("Voice subtitle evidence requires preparation metadata.");
  }
  const preparationText = await readFile(resolveArtifact(sourcePreparation.metadataPath), "utf8");
  const preparation = voiceoverPreparationV2Schema.parse(JSON.parse(preparationText) as unknown);
  const preparedText = await readFile(resolveArtifact(sourcePreparation.path), "utf8");
  const sourceText = await readFile(resolveArtifact(meta.source.path), "utf8");
  const stats = inspectVoiceSubtitleSrt(subtitleText);
  if (
    metadata.runId !== run.runId ||
    metadata.timingMode !== descriptor.timingMode ||
    metadata.output.path !== descriptor.path ||
    metadata.output.sha256 !== descriptor.sha256 ||
    metadata.output.cueCount !== descriptor.cueCount ||
    Math.abs(metadata.output.lastCueEndSeconds - descriptor.sourceDurationSeconds) > 0.001 ||
    stats.cueCount !== metadata.output.cueCount ||
    Math.abs(stats.firstCueStartSeconds - metadata.output.firstCueStartSeconds) > 0.001 ||
    Math.abs(stats.lastCueEndSeconds - metadata.output.lastCueEndSeconds) > 0.001 ||
    metadata.audio.sha256 !== audioDigest ||
    Math.abs(metadata.audio.durationSeconds - meta.output.durationSeconds) > 0.001 ||
    metadata.source.sha256 !== meta.source.sha256 ||
    createHash("sha256").update(sourceText, "utf8").digest("hex") !== meta.source.sha256 ||
    metadata.source.normalizedSha256 !== preparation.source.normalizedSha256 ||
    metadata.source.normalizedCharacterCount !== preparation.source.normalizedCharacterCount ||
    metadata.prepared.sha256 !== sourcePreparation.sha256 ||
    createHash("sha256").update(preparedText, "utf8").digest("hex") !== sourcePreparation.sha256 ||
    metadata.prepared.characterCount !== preparedText.length ||
    metadata.preparation.sha256 !== sourcePreparation.metadataSha256 ||
    createHash("sha256").update(preparationText, "utf8").digest("hex") !==
      sourcePreparation.metadataSha256 ||
    metadata.alignment?.sha256 !== meta.alignment?.sha256 ||
    metadata.normalizedAlignment?.sha256 !== meta.normalizedAlignment?.sha256
  ) {
    throw new SafeExitError("Voice subtitle metadata does not match current voice evidence.");
  }
  if (
    (meta.mode === "elevenlabs" && descriptor.timingMode !== "elevenlabs-character-aligned") ||
    (meta.mode !== "elevenlabs" && descriptor.timingMode !== "linear-fallback")
  ) {
    throw new SafeExitError("Voice subtitle timing mode does not match the voice provider mode.");
  }
  if (descriptor.timingMode === "elevenlabs-character-aligned") {
    await assertAlignedSubtitleTimeline(meta, preparedText, resolveArtifact);
  }
  return descriptor;
}

async function assertAlignedSubtitleTimeline(
  meta: Extract<VoiceoverAudioMeta, { schemaVersion: 2 }>,
  preparedText: string,
  resolveArtifact: (relativePath: string) => string,
): Promise<void> {
  if (!meta.alignment) {
    throw new SafeExitError("Aligned voice subtitles require original alignment evidence.");
  }
  const alignmentText = await readFile(resolveArtifact(meta.alignment.path), "utf8");
  const alignment = persistedAlignmentSchema.parse(JSON.parse(alignmentText) as unknown);
  if (createHash("sha256").update(alignmentText, "utf8").digest("hex") !== meta.alignment.sha256) {
    throw new SafeExitError("Original alignment digest does not match voice metadata.");
  }
  if (alignment.characters.join("") !== preparedText) {
    throw new SafeExitError(
      "Original alignment characters do not exactly match prepared synthesis text.",
    );
  }
  let previousEnd = 0;
  for (let index = 0; index < alignment.characters.length; index += 1) {
    const start = alignment.characterStartTimesSeconds[index] ?? -1;
    const end = alignment.characterEndTimesSeconds[index] ?? -1;
    if (start < previousEnd || end < start || end > meta.output.durationSeconds + 0.001) {
      throw new SafeExitError(
        "Original alignment timeline is not monotonic or exceeds voice audio.",
      );
    }
    previousEnd = end;
  }
}
