import { z } from "zod";

import {
  filesystemSegmentSchema,
  pricingSnapshotSchema,
  providerIdentifierSchema,
  sha256Schema,
  subscriptionSnapshotSchema,
  terminalSafeString,
  voiceCandidateSchema,
  voiceCandidatesArtifactPathSchema,
  voiceCandidatesPath,
  voiceIdSchema,
} from "./voiceCatalogContracts.js";
import {
  hasUnsafeControlCharacters,
  hasUnsafeNotesControlCharacters,
} from "./voiceCatalogValueNormalization.js";

export const voicePreviewDirectory = "production/audio/voice-previews";
export const voicePreviewFailureDirectory = "diagnostics/voice-preview-failures";
export const voiceSelectionDirectory = "production/audio/voice-selections";
// Read-only compatibility for evidence produced by the first audition slice.
export const voicePreviewFailurePath = "diagnostics/voice_preview_failure.json";
export const voiceSelectionPath = "production/audio/voice_selection.json";

const voicePreviewEvidenceArtifactPathSchema = z
  .string()
  .regex(/^production\/audio\/voice-previews\/[A-Za-z0-9._-]{1,128}\/[A-Za-z0-9._-]{1,128}\.json$/);
const voicePreviewAudioArtifactPathSchema = z
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
const notesSafeString = (maximumLength: number) =>
  z
    .string()
    .min(1)
    .max(maximumLength)
    .refine((value) => !hasUnsafeNotesControlCharacters(value), "Text contains unsafe controls.");

export const voicePreviewEvidenceSchema = z.strictObject({
  schemaVersion: z.literal(1),
  runId: z.string().min(1),
  createdAt: z.iso.datetime(),
  provider: z.literal("elevenlabs"),
  catalogDigest: sha256Schema,
  candidate: z.strictObject({ voiceId: voiceIdSchema, metadataDigest: sha256Schema }),
  model: z.strictObject({ modelId: providerIdentifierSchema, metadataDigest: sha256Schema }),
  source: z.strictObject({
    sourceClass: z.enum(["elevenlabs", "eleven-public-prod"]),
    urlSha256: sha256Schema,
    requestIdHashes: z.array(sha256Schema).max(4),
  }),
  output: z.strictObject({
    path: z.union([
      z.string().regex(/^production\/audio\/previews\/[A-Za-z0-9._-]{1,128}\.(mp3|wav)$/),
      voicePreviewAudioArtifactPathSchema,
    ]),
    sha256: sha256Schema,
    bytes: z
      .number()
      .int()
      .positive()
      .max(5 * 1024 * 1024),
    format: z.enum(["mp3", "wav"]),
    mimeType: z.enum(["audio/mpeg", "audio/wav"]),
  }),
  previewDigest: sha256Schema,
});

export const voicePreviewFailureSchema = z.strictObject({
  schemaVersion: z.literal(1),
  runId: z.string().min(1),
  createdAt: z.iso.datetime(),
  provider: z.literal("elevenlabs"),
  voiceId: voiceIdSchema,
  code: z.enum(["catalog-stale", "metadata-changed", "provider-unavailable", "unsafe-preview"]),
  message: terminalSafeString(300),
  nextAction: terminalSafeString(300),
});

export const voiceSelectionSchema = z.strictObject({
  schemaVersion: z.literal(1),
  runId: z.string().min(1),
  selectedAt: z.iso.datetime(),
  selectedBy: terminalSafeString(200),
  notes: notesSafeString(4_000),
  provider: z.literal("elevenlabs"),
  catalog: z.strictObject({
    path: z.union([z.literal(voiceCandidatesPath), voiceCandidatesArtifactPathSchema]),
    digest: sha256Schema,
  }),
  preview: z.strictObject({
    evidencePath: z.union([
      z.string().regex(/^production\/audio\/previews\/[A-Za-z0-9._-]{1,128}\.json$/),
      voicePreviewEvidenceArtifactPathSchema,
    ]),
    digest: sha256Schema,
    audioPath: z.union([
      z.string().regex(/^production\/audio\/previews\/[A-Za-z0-9._-]{1,128}\.(mp3|wav)$/),
      voicePreviewAudioArtifactPathSchema,
    ]),
    audioSha256: sha256Schema,
  }),
  voice: z.strictObject({
    voiceId: voiceIdSchema,
    name: terminalSafeString(120),
    category: terminalSafeString(64),
    metadataDigest: sha256Schema,
    verifiedTurkish: z.boolean(),
    productionEligibility: voiceCandidateSchema.shape.productionEligibility,
  }),
  model: z.strictObject({
    modelId: providerIdentifierSchema,
    metadataDigest: sha256Schema,
    languageCode: z.literal("tr"),
    maximumTextLengthPerRequest: z.number().int().positive().max(100_000),
  }),
  synthesis: z.strictObject({
    outputFormat: terminalSafeString(64),
    maxCharactersPerRequest: z.number().int().positive().max(100_000),
    voiceSettingsDigest: sha256Schema,
  }),
  pricing: pricingSnapshotSchema,
  subscription: z.strictObject({
    tier: terminalSafeString(80),
    productionUseStatus: subscriptionSnapshotSchema.shape.productionUseStatus,
    digest: sha256Schema,
  }),
  productionRights: z.strictObject({ required: z.boolean(), confirmed: z.boolean() }),
  selectionDigest: sha256Schema,
});

export const voiceSelectionInputSchema = z.strictObject({
  voiceId: voiceIdSchema,
  reviewedBy: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .refine((value) => !hasUnsafeControlCharacters(value), "Reviewer contains unsafe controls."),
  notes: z
    .string()
    .trim()
    .min(1)
    .max(4_000)
    .refine((value) => !hasUnsafeNotesControlCharacters(value), "Notes contain unsafe controls."),
  confirmProductionRights: z.boolean().default(false),
});

export function voicePreviewAudioPath(
  voiceId: string,
  artifactId: string,
  format: "mp3" | "wav",
): string {
  return `${voicePreviewDirectory}/${voiceIdSchema.parse(voiceId)}/${filesystemSegmentSchema.parse(artifactId)}.${format}`;
}

export function voicePreviewEvidencePath(voiceId: string, artifactId: string): string {
  return `${voicePreviewDirectory}/${voiceIdSchema.parse(voiceId)}/${filesystemSegmentSchema.parse(artifactId)}.json`;
}

export function voicePreviewFailureArtifactPath(voiceId: string, artifactId: string): string {
  return `${voicePreviewFailureDirectory}/${voiceIdSchema.parse(voiceId)}/${filesystemSegmentSchema.parse(artifactId)}.json`;
}

export function voiceSelectionArtifactPath(artifactId: string): string {
  return `${voiceSelectionDirectory}/${filesystemSegmentSchema.parse(artifactId)}.json`;
}

export function isVoicePreviewEvidenceArtifactPath(relativePath: string, voiceId: string): boolean {
  const safeVoiceId = voiceIdSchema.parse(voiceId);
  return (
    relativePath === `production/audio/previews/${safeVoiceId}.json` ||
    (voicePreviewEvidenceArtifactPathSchema.safeParse(relativePath).success &&
      relativePath.startsWith(`${voicePreviewDirectory}/${safeVoiceId}/`))
  );
}

export function isVoicePreviewAudioArtifactPath(relativePath: string, voiceId: string): boolean {
  const safeVoiceId = voiceIdSchema.parse(voiceId);
  return (
    relativePath === `production/audio/previews/${safeVoiceId}.mp3` ||
    relativePath === `production/audio/previews/${safeVoiceId}.wav` ||
    (voicePreviewAudioArtifactPathSchema.safeParse(relativePath).success &&
      relativePath.startsWith(`${voicePreviewDirectory}/${safeVoiceId}/`))
  );
}

export function isVoicePreviewFailureArtifactPath(relativePath: string, voiceId: string): boolean {
  const safeVoiceId = voiceIdSchema.parse(voiceId);
  return (
    relativePath === voicePreviewFailurePath ||
    (voicePreviewFailureArtifactPathSchema.safeParse(relativePath).success &&
      relativePath.startsWith(`${voicePreviewFailureDirectory}/${safeVoiceId}/`))
  );
}

export function isVoiceSelectionArtifactPath(relativePath: string): boolean {
  return (
    relativePath === voiceSelectionPath ||
    voiceSelectionArtifactPathSchema.safeParse(relativePath).success
  );
}

export type VoicePreviewEvidence = z.infer<typeof voicePreviewEvidenceSchema>;
export type VoicePreviewFailure = z.infer<typeof voicePreviewFailureSchema>;
export type VoiceSelection = z.infer<typeof voiceSelectionSchema>;
export type VoiceSelectionInput = z.input<typeof voiceSelectionInputSchema>;
