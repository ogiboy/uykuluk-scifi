import { z } from "zod";

export const providerRequestEvidenceItemSchema = z.strictObject({
  requestIndex: z.int().nonnegative(),
  inputDigest: z.string().regex(/^[a-f0-9]{64}$/),
  requestIdHash: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  reportedUnits: z.number().nonnegative().optional(),
});

export const providerRequestEvidenceSchema = z.array(providerRequestEvidenceItemSchema).max(10_000);

export type ProviderRequestEvidence = z.infer<typeof providerRequestEvidenceSchema>;
