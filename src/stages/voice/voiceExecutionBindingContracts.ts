import { z } from "zod";

import {
  isVoiceSelectionArtifactPath,
  voiceSelectionPath,
} from "./catalog/voiceAuditionContracts.js";
import {
  pricingSnapshotSchema,
  providerIdentifierSchema,
  sha256Schema,
  voiceIdSchema,
} from "./catalog/voiceCatalogContracts.js";
import { wavOutputFormatSchema } from "./providers/elevenLabsTtsContracts.js";

const voiceSelectionArtifactPathSchema = z
  .string()
  .min(1)
  .max(300)
  .refine(isVoiceSelectionArtifactPath, "Invalid voice selection artifact path.");

const nonnegativeBoundedInteger = z.int().nonnegative().max(1_000_000_000);

export const selectedVoiceExecutionBindingSchema = z.strictObject({
  schemaVersion: z.literal(1),
  provider: z.literal("elevenlabs"),
  selection: z.strictObject({
    path: z.union([z.literal(voiceSelectionPath), voiceSelectionArtifactPathSchema]),
    digest: sha256Schema,
  }),
  catalog: z.strictObject({ path: z.string().min(1).max(300), digest: sha256Schema }),
  voice: z.strictObject({ voiceId: voiceIdSchema, metadataDigest: sha256Schema }),
  model: z.strictObject({
    modelId: providerIdentifierSchema,
    metadataDigest: sha256Schema,
    languageCode: z.literal("tr"),
    maximumTextLengthPerRequest: z.int().positive().max(100_000),
  }),
  synthesis: z.strictObject({
    outputFormat: wavOutputFormatSchema,
    maxCharactersPerRequest: z.int().min(250).max(5_000),
    voiceSettingsDigest: sha256Schema,
    applyTextNormalization: z.enum(["auto", "on", "off"]),
    seed: z.int().nonnegative().max(4_294_967_295),
    timeoutMs: z.int().positive().max(600_000),
    maxRetries: z.literal(0),
  }),
  pricing: pricingSnapshotSchema,
  subscription: z.strictObject({
    tier: z.string().min(1).max(80),
    status: z.string().min(1).max(80),
    currency: z.string().min(1).max(16).optional(),
    hasOpenInvoices: z.literal(false),
    digest: sha256Schema,
    productionUseStatus: z.literal("operator-rights-required"),
    characterCount: nonnegativeBoundedInteger,
    characterLimit: nonnegativeBoundedInteger,
    remainingCharacters: nonnegativeBoundedInteger,
  }),
  input: z.strictObject({
    preparedTextDigest: sha256Schema,
    characterCount: z.int().positive().max(1_000_000_000),
    chunkCount: z.int().positive().max(10_000),
    chunkPlanDigest: sha256Schema,
  }),
  bindingDigest: sha256Schema,
});

export type SelectedVoiceExecutionBinding = z.infer<typeof selectedVoiceExecutionBindingSchema>;
