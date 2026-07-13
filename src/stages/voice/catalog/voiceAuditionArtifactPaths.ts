import { z } from "zod";

import { filesystemSegmentSchema, voiceIdSchema } from "./voiceCatalogContracts.js";

export const voicePreviewDirectory = "production/audio/voice-previews";
export const voicePreviewFailureDirectory = "diagnostics/voice-preview-failures";
export const voiceSelectionDirectory = "production/audio/voice-selections";
// Read-only compatibility for evidence produced by the first audition slice.
export const voicePreviewFailurePath = "diagnostics/voice_preview_failure.json";
export const voiceSelectionPath = "production/audio/voice_selection.json";

export const voicePreviewEvidenceArtifactPathSchema = z
  .string()
  .regex(/^production\/audio\/voice-previews\/[A-Za-z0-9._-]{1,128}\/[A-Za-z0-9._-]{1,128}\.json$/);
export const voicePreviewAudioArtifactPathSchema = z
  .string()
  .regex(
    /^production\/audio\/voice-previews\/[A-Za-z0-9._-]{1,128}\/[A-Za-z0-9._-]{1,128}\.(mp3|wav)$/,
  );
const voicePreviewFailureArtifactPathSchema = z
  .string()
  .regex(
    /^diagnostics\/voice-preview-failures\/[A-Za-z0-9._-]{1,128}\/[A-Za-z0-9._-]{1,128}\.json$/,
  );
const voiceSelectionArtifactPathSchema = z
  .string()
  .regex(/^production\/audio\/voice-selections\/[A-Za-z0-9._-]{1,128}\.json$/);

/**
 * Builds the relative path for a voice preview audio artifact.
 *
 * @param voiceId - The voice identifier used in the artifact directory
 * @param artifactId - The artifact identifier used in the filename
 * @param format - The audio format
 * @returns The validated voice preview audio artifact path
 */
export function voicePreviewAudioPath(
  voiceId: string,
  artifactId: string,
  format: "mp3" | "wav",
): string {
  return `${voicePreviewDirectory}/${voiceIdSchema.parse(voiceId)}/${filesystemSegmentSchema.parse(artifactId)}.${format}`;
}

/**
 * Builds the relative path for a voice preview evidence artifact.
 *
 * @param voiceId - The voice identifier used in the artifact directory
 * @param artifactId - The artifact identifier used in the filename
 * @returns The validated JSON evidence artifact path
 */
export function voicePreviewEvidencePath(voiceId: string, artifactId: string): string {
  return `${voicePreviewDirectory}/${voiceIdSchema.parse(voiceId)}/${filesystemSegmentSchema.parse(artifactId)}.json`;
}

/**
 * Builds the validated artifact path for a voice preview failure.
 *
 * @param voiceId - The identifier of the voice associated with the failure
 * @param artifactId - The identifier of the failure artifact
 * @returns The relative JSON path for the voice preview failure artifact
 */
export function voicePreviewFailureArtifactPath(voiceId: string, artifactId: string): string {
  return `${voicePreviewFailureDirectory}/${voiceIdSchema.parse(voiceId)}/${filesystemSegmentSchema.parse(artifactId)}.json`;
}

/**
 * Builds the artifact path for a voice selection.
 *
 * @param artifactId - The validated artifact identifier used in the filename
 * @returns The relative JSON artifact path
 */
export function voiceSelectionArtifactPath(artifactId: string): string {
  return `${voiceSelectionDirectory}/${filesystemSegmentSchema.parse(artifactId)}.json`;
}

/**
 * Determines whether a relative path identifies voice preview evidence for a voice.
 *
 * @param relativePath - The relative artifact path to evaluate
 * @param voiceId - The voice identifier associated with the artifact
 * @returns `true` if the path identifies evidence for `voiceId`, `false` otherwise
 */
export function isVoicePreviewEvidenceArtifactPath(relativePath: string, voiceId: string): boolean {
  const safeVoiceId = voiceIdSchema.parse(voiceId);
  return (
    relativePath === `production/audio/previews/${safeVoiceId}.json` ||
    (voicePreviewEvidenceArtifactPathSchema.safeParse(relativePath).success &&
      relativePath.startsWith(`${voicePreviewDirectory}/${safeVoiceId}/`))
  );
}

/**
 * Determines whether a relative path identifies audio for the specified voice preview.
 *
 * @param relativePath - The relative artifact path to check
 * @param voiceId - The voice identifier associated with the preview
 * @returns `true` if the path is a supported voice preview audio artifact, `false` otherwise
 */
export function isVoicePreviewAudioArtifactPath(relativePath: string, voiceId: string): boolean {
  const safeVoiceId = voiceIdSchema.parse(voiceId);
  return (
    relativePath === `production/audio/previews/${safeVoiceId}.mp3` ||
    relativePath === `production/audio/previews/${safeVoiceId}.wav` ||
    (voicePreviewAudioArtifactPathSchema.safeParse(relativePath).success &&
      relativePath.startsWith(`${voicePreviewDirectory}/${safeVoiceId}/`))
  );
}

/**
 * Determines whether a path identifies a voice preview failure artifact for a voice.
 *
 * @param relativePath - The relative path to evaluate
 * @param voiceId - The voice identifier associated with the artifact
 * @returns `true` if the path is the legacy failure path or a validated failure artifact path for `voiceId`, `false` otherwise
 */
export function isVoicePreviewFailureArtifactPath(relativePath: string, voiceId: string): boolean {
  const safeVoiceId = voiceIdSchema.parse(voiceId);
  return (
    relativePath === voicePreviewFailurePath ||
    (voicePreviewFailureArtifactPathSchema.safeParse(relativePath).success &&
      relativePath.startsWith(`${voicePreviewFailureDirectory}/${safeVoiceId}/`))
  );
}

/**
 * Determines whether a relative path identifies a voice selection artifact.
 *
 * @param relativePath - The relative path to evaluate.
 * @returns `true` if the path is a supported voice selection artifact path, `false` otherwise.
 */
export function isVoiceSelectionArtifactPath(relativePath: string): boolean {
  return (
    relativePath === voiceSelectionPath ||
    voiceSelectionArtifactPathSchema.safeParse(relativePath).success
  );
}
