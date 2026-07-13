import { z } from "zod";

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

/** Operator-readable preimage summary for a domain-owned execution binding. */
export const costBindingSummarySchema = z.strictObject({
  kind: z.literal("selected-voice"),
  selectionDigest: sha256Schema,
  voiceId: z.string().min(1).max(128),
  modelId: z.string().min(1).max(128),
  pricingDigest: sha256Schema,
  expectedUsdPerThousandCharacters: z.number().positive().max(100),
  maximumUsdPerThousandCharacters: z.number().positive().max(100),
});

export type CostBindingSummary = z.infer<typeof costBindingSummarySchema>;
