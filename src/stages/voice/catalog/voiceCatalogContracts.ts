import { z } from "zod";

import { hasUnsafeControlCharacters } from "./voiceCatalogValueNormalization.js";

export const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
export const terminalSafeString = (maximumLength: number) =>
  z
    .string()
    .min(1)
    .max(maximumLength)
    .refine((value) => !hasUnsafeControlCharacters(value), "Text contains unsafe controls.");
const boundedTextSchema = terminalSafeString(500);
export const providerIdentifierSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9._-]+$/);
export const filesystemSegmentSchema = providerIdentifierSchema.refine(
  (value) => value !== "." && value !== "..",
  "Filesystem segment cannot be a dot path segment.",
);
export const voiceIdSchema = filesystemSegmentSchema;

export const voiceCandidatesDirectory = "production/audio/voice-candidates";
export const voiceCatalogFailureDirectory = "diagnostics/voice-catalog-failures";
// Read-only compatibility for evidence produced by the first catalog slice.
export const voiceCandidatesPath = "production/audio/voice_candidates.json";
export const voiceCatalogFailurePath = "diagnostics/voice_catalog_failure.json";

export const voiceCandidatesArtifactPathSchema = z
  .string()
  .regex(/^production\/audio\/voice-candidates\/[A-Za-z0-9._-]{1,128}\.json$/);
const voiceCatalogFailureArtifactPathSchema = z
  .string()
  .regex(/^diagnostics\/voice-catalog-failures\/[A-Za-z0-9._-]{1,128}\.json$/);

const verifiedLanguageSchema = z.strictObject({
  language: terminalSafeString(16),
  modelId: providerIdentifierSchema,
  accent: terminalSafeString(80).optional(),
  locale: terminalSafeString(32).optional(),
  hasPreview: z.boolean(),
});

const candidateSharingSchema = z.strictObject({
  status: terminalSafeString(64).optional(),
  freeUsersAllowed: z.boolean().optional(),
  liveModerationEnabled: z.boolean(),
  customRate: z.boolean(),
  noticePeriodDays: z.number().nonnegative().optional(),
  disableAtUnix: z.number().int().nonnegative().optional(),
  enabledInLibrary: z.boolean().optional(),
});

export const voiceCandidateSchema = z.strictObject({
  voiceId: voiceIdSchema,
  name: terminalSafeString(120),
  category: terminalSafeString(64),
  description: boundedTextSchema.optional(),
  labels: z
    .array(z.strictObject({ key: terminalSafeString(64), value: terminalSafeString(120) }))
    .max(12),
  availableForTiers: z.array(terminalSafeString(64)).max(16),
  verifiedLanguages: z.array(verifiedLanguageSchema).max(32),
  highQualityBaseModelIds: z.array(providerIdentifierSchema).max(32),
  isOwner: z.boolean(),
  isLegacy: z.boolean(),
  isMixed: z.boolean(),
  recordingQuality: terminalSafeString(64).optional(),
  sharing: candidateSharingSchema.optional(),
  preview: z.strictObject({
    available: z.boolean(),
    source: z.enum(["verified-language", "voice", "none"]),
    sourceClass: z.enum(["elevenlabs", "eleven-public-prod", "unsupported", "none"]),
    urlSha256: sha256Schema.optional(),
  }),
  productionEligibility: z.strictObject({
    status: z.enum(["eligible", "review-required", "preview-only", "blocked"]),
    reasons: z.array(terminalSafeString(300)).max(8),
  }),
  metadataDigest: sha256Schema,
});

export const subscriptionSnapshotSchema = z.strictObject({
  tier: terminalSafeString(80),
  status: terminalSafeString(80),
  characterCount: z.number().int().nonnegative(),
  characterLimit: z.number().int().nonnegative(),
  currency: terminalSafeString(16).optional(),
  hasOpenInvoices: z.boolean(),
  productionUseStatus: z.enum(["blocked-free-tier", "operator-rights-required"]),
  digest: sha256Schema,
});

const modelSnapshotSchema = z.strictObject({
  modelId: providerIdentifierSchema,
  name: terminalSafeString(120).optional(),
  canDoTextToSpeech: z.literal(true),
  canUseStyle: z.boolean(),
  canUseSpeakerBoost: z.boolean(),
  maximumTextLengthPerRequest: z.number().int().positive().max(100_000),
  maxCharactersRequestFreeUser: z.number().int().positive().max(100_000).optional(),
  maxCharactersRequestSubscribedUser: z.number().int().positive().max(100_000).optional(),
  languages: z.array(terminalSafeString(16)).min(1).max(256),
  concurrencyGroup: terminalSafeString(120).optional(),
  metadataDigest: sha256Schema,
});

export const pricingSnapshotSchema = z.strictObject({
  source: z.literal("configured-base-plus-models-api"),
  baseUsdPerThousandCharacters: z.number().positive().max(100),
  characterCostMultiplier: z.number().positive().max(100),
  costDiscountMultiplier: z.number().positive().max(100),
  effectiveUsdPerThousandCharacters: z.number().positive().max(100),
  exactness: z.literal("standard-voice-only"),
  digest: sha256Schema,
});

export const voiceCatalogProviderResultSchema = z.strictObject({
  provider: z.literal("elevenlabs"),
  fetchedAt: z.iso.datetime(),
  requestIdHashes: z.array(sha256Schema).max(16),
  sourceVoiceCount: z.number().int().nonnegative().max(10_000),
  rejectedVoiceCount: z.number().int().nonnegative().max(10_000),
  subscription: subscriptionSnapshotSchema,
  model: modelSnapshotSchema,
  pricing: pricingSnapshotSchema,
  candidates: z.array(voiceCandidateSchema).max(24),
});

export const voiceCandidatesSchema = voiceCatalogProviderResultSchema.extend({
  schemaVersion: z.literal(1),
  runId: z.string().min(1),
  catalogDigest: sha256Schema,
});

export const voiceCatalogFailureSchema = z.strictObject({
  schemaVersion: z.literal(1),
  runId: z.string().min(1),
  createdAt: z.iso.datetime(),
  provider: z.literal("elevenlabs"),
  modelId: providerIdentifierSchema,
  code: z.enum(["configuration", "provider-unavailable", "provider-response-invalid"]),
  requestIdHashes: z.array(sha256Schema).max(16),
  message: terminalSafeString(300),
  nextAction: terminalSafeString(300),
});

export function voiceCandidatesArtifactPath(artifactId: string): string {
  return `${voiceCandidatesDirectory}/${filesystemSegmentSchema.parse(artifactId)}.json`;
}

export function voiceCatalogFailureArtifactPath(artifactId: string): string {
  return `${voiceCatalogFailureDirectory}/${filesystemSegmentSchema.parse(artifactId)}.json`;
}

export function isVoiceCandidatesArtifactPath(relativePath: string): boolean {
  return (
    relativePath === voiceCandidatesPath ||
    voiceCandidatesArtifactPathSchema.safeParse(relativePath).success
  );
}

export function isVoiceCatalogFailureArtifactPath(relativePath: string): boolean {
  return (
    relativePath === voiceCatalogFailurePath ||
    voiceCatalogFailureArtifactPathSchema.safeParse(relativePath).success
  );
}

export type VoiceCandidate = z.infer<typeof voiceCandidateSchema>;
export type VoiceCatalogProviderResult = z.infer<typeof voiceCatalogProviderResultSchema>;
export type VoiceCandidates = z.infer<typeof voiceCandidatesSchema>;
export type VoiceCatalogFailure = z.infer<typeof voiceCatalogFailureSchema>;
