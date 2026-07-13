import { z } from "zod";

import { isValidArtifactRelativePath } from "../../core/artifactPaths.js";
import { sha256Schema } from "./catalog/voiceCatalogContracts.js";
import { elevenLabsBillingEvidenceSchema } from "./providers/elevenLabsTtsContracts.js";
import { selectedVoiceExecutionBindingSchema } from "./voiceExecutionBinding.js";
import { voiceExecutionPreflightReceiptSchema } from "./voiceExecutionPreflight.js";
import { voiceExecutionSpoolReferenceSchema } from "./voiceExecutionSpool.js";

const canonicalArtifactPathSchema = z
  .string()
  .min(1)
  .max(300)
  .refine(isValidArtifactRelativePath, "Expected a canonical relative artifact path.");

export const paidVoiceExecutionEvidenceSchema = z.strictObject({
  schemaVersion: z.literal(1),
  bindingDigest: sha256Schema,
  binding: selectedVoiceExecutionBindingSchema,
  selection: z.strictObject({
    path: canonicalArtifactPathSchema,
    digest: sha256Schema,
    catalogPath: canonicalArtifactPathSchema,
    catalogDigest: sha256Schema,
    voiceMetadataDigest: sha256Schema,
    modelMetadataDigest: sha256Schema,
    pricingDigest: sha256Schema,
    subscriptionDigest: sha256Schema,
  }),
  liveValidation: voiceExecutionPreflightReceiptSchema,
  quoteDigest: sha256Schema,
  approvalId: z.string().min(1),
  operationId: z.string().regex(/^tts_[a-f0-9]{64}$/),
  reservationId: z.string().min(1),
  reservationStatus: z.literal("SETTLED"),
  actualUsdMicros: z.int().nonnegative(),
  billing: elevenLabsBillingEvidenceSchema,
  resultSpool: voiceExecutionSpoolReferenceSchema,
});

export type PaidVoiceExecutionEvidence = z.infer<typeof paidVoiceExecutionEvidenceSchema>;
