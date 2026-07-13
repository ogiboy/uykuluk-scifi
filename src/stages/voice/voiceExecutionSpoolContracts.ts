import { z } from "zod";

import { sha256Schema } from "./catalog/voiceCatalogContracts.js";
import {
  elevenLabsBillingEvidenceSchema,
  elevenLabsRequestEvidenceSchema,
} from "./providers/elevenLabsTtsContracts.js";
import type { TtsSynthesisResult } from "./providers/ttsProvider.js";
import {
  selectedVoiceExecutionBindingSchema,
  type SelectedVoiceExecutionBinding,
} from "./voiceExecutionBinding.js";
import {
  voiceExecutionPreflightReceiptSchema,
  type VoiceExecutionPreflightReceipt,
} from "./voiceExecutionPreflight.js";
import type { VoiceoverPreparation } from "./voiceoverPreparation.js";

export const operationIdSchema = z.string().regex(/^tts_[a-f0-9]{64}$/);
const spoolPathSchema = z.string().regex(/^operations\/tts\/tts_[a-f0-9]{64}\/result\.json$/);
const preparedTextPathSchema = z
  .string()
  .regex(/^operations\/tts\/tts_[a-f0-9]{64}\/prepared-text\.txt$/);
const preparationEvidencePathSchema = z
  .string()
  .regex(/^operations\/tts\/tts_[a-f0-9]{64}\/preparation\.json$/);

export const voiceExecutionSpoolReferenceSchema = z.strictObject({
  operationId: operationIdSchema,
  path: spoolPathSchema,
  digest: sha256Schema,
});

export type VoiceExecutionSpoolReference = z.infer<typeof voiceExecutionSpoolReferenceSchema>;

export const voiceExecutionSpoolProviderSchema = z.strictObject({
  service: z.literal("elevenlabs"),
  modelId: z.string().min(1),
  voiceId: z.string().min(1),
  outputFormat: z.string().min(1),
});

const peakNormalizationSchema = z.strictObject({
  applied: z.boolean(),
  gainDb: z.number().max(0),
  sourcePeakDbfs: z.number().max(0),
  targetPeakDbfs: z.number().negative(),
});

export const voiceExecutionSpoolSchema = z.strictObject({
  schemaVersion: z.literal(1),
  runId: z.string().min(1),
  operationId: operationIdSchema,
  binding: selectedVoiceExecutionBindingSchema,
  preparationDigest: sha256Schema,
  preparation: z.strictObject({
    text: z.strictObject({
      path: preparedTextPathSchema,
      sha256: sha256Schema,
      bytes: z.int().positive(),
    }),
    evidence: z.strictObject({
      path: preparationEvidencePathSchema,
      sha256: sha256Schema,
      bytes: z.int().positive(),
    }),
  }),
  approvedQuote: z.strictObject({ quoteDigest: sha256Schema, approvalId: z.string().min(1) }),
  liveValidation: voiceExecutionPreflightReceiptSchema,
  actualUsdMicros: z.int().nonnegative(),
  providerRequestIdHash: sha256Schema.optional(),
  audio: z.strictObject({
    path: z.string().regex(/^operations\/tts\/tts_[a-f0-9]{64}\/result\.wav$/),
    sha256: sha256Schema,
    bytes: z.int().positive(),
  }),
  alignment: z.strictObject({
    path: z.string().regex(/^operations\/tts\/tts_[a-f0-9]{64}\/alignment\.json$/),
    sha256: sha256Schema,
    characterCount: z.int().positive(),
  }),
  result: z.strictObject({
    channels: z.int().positive(),
    durationSeconds: z.number().positive(),
    provider: voiceExecutionSpoolProviderSchema,
    providerBilling: elevenLabsBillingEvidenceSchema,
    providerRequests: z.array(elevenLabsRequestEvidenceSchema).min(1),
    processing: z.strictObject({ peakNormalization: peakNormalizationSchema }).optional(),
    quality: z.literal("elevenlabs"),
    sampleRateHz: z.int().positive(),
  }),
  createdAt: z.iso.datetime(),
  spoolDigest: sha256Schema,
});

export type VoiceExecutionSpool = z.infer<typeof voiceExecutionSpoolSchema>;

export type LoadedVoiceExecutionSpool = {
  reference: VoiceExecutionSpoolReference;
  binding: SelectedVoiceExecutionBinding;
  preflight: VoiceExecutionPreflightReceipt;
  approvedQuote: { quoteDigest: string; approvalId: string };
  actualUsdMicros: number;
  providerRequestIdHash?: string;
  alignmentReference: { digest: string; characterCount: number };
  preparation: { text: string; evidence: VoiceoverPreparation; evidenceText: string };
  audio: TtsSynthesisResult;
};
