import { z } from "zod";

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

const selectedVoiceBindingSummarySchema = z.strictObject({
  kind: z.literal("selected-voice"),
  selectionDigest: sha256Schema,
  voiceId: z.string().min(1).max(128),
  modelId: z.string().min(1).max(128),
  pricingDigest: sha256Schema,
  expectedUsdPerThousandCharacters: z.number().positive().max(100),
  maximumUsdPerThousandCharacters: z.number().positive().max(100),
});

const hostedVisualBindingSummarySchema = z.strictObject({
  kind: z.literal("hosted-visual-generation"),
  planDigest: sha256Schema,
  visualManifestDigest: sha256Schema,
  pricingDigest: sha256Schema,
  targetedSceneIndexes: z.array(z.int().positive()).min(1).max(24),
  maximumUsdPerImage: z.number().positive().max(100),
  totalMaximumUsd: z.number().positive().max(2_400),
});

const settledPaidStageBindingSummarySchema = z.strictObject({
  kind: z.literal("settled-paid-stage"),
  stage: z.string().min(1).max(100),
  originalQuoteDigest: sha256Schema,
  originalApprovalId: z.string().min(1).max(200),
  reservationId: z.string().min(1).max(200),
  resultEvidenceDigest: sha256Schema,
  actualUsdMicros: z.int().nonnegative(),
});

/** Operator-readable preimage summary for a domain-owned execution binding. */
export const costBindingSummarySchema = z.discriminatedUnion("kind", [
  selectedVoiceBindingSummarySchema,
  hostedVisualBindingSummarySchema,
  settledPaidStageBindingSummarySchema,
]);

export type CostBindingSummary = z.infer<typeof costBindingSummarySchema>;
