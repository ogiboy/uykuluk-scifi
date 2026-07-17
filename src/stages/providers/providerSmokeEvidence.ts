import { z } from "zod";

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const operationIdSchema = z.string().regex(/^provider_smoke_\d{14}_[a-f0-9]{6}$/);

export const providerSmokeErrorCategorySchema = z.enum([
  "authentication",
  "access-denied",
  "invalid-request",
  "rate-limited",
  "provider-unavailable",
  "timeout",
]);

const entitlementSchema = z.strictObject({
  tier: z.string().min(1).max(80),
  status: z.string().min(1).max(80),
  usedCredits: z.int().nonnegative(),
  creditLimit: z.int().nonnegative(),
  remainingCredits: z.int().nonnegative(),
  expectedCredits: z.int().positive(),
  maxCreditLimitExtension: z.union([z.number().nonnegative(), z.literal("unlimited")]),
  canExtendCreditLimit: z.boolean(),
  currentOverageAmount: z.string().regex(/^\d+(?:\.\d+)?$/),
  currentOverageCurrency: z.string().min(1).max(16),
  hasOpenInvoices: z.boolean(),
  nextCreditResetUnix: z.int().nonnegative().optional(),
});

const providerSmokeBaseSchema = z.strictObject({
  schemaVersion: z.literal(1),
  provider: z.literal("elevenlabs"),
  capability: z.literal("text-to-speech-with-timestamps"),
  operationId: operationIdSchema,
  usage: z.literal("diagnostic-only"),
  productionEligible: z.literal(false),
  createdAt: z.iso.datetime(),
  completedAt: z.iso.datetime(),
  modelId: z.literal("eleven_v3"),
  voiceId: z.string().min(1).max(128),
  inputDigest: sha256Schema,
  inputCharacterCount: z.int().min(1).max(180),
  requestSent: z.boolean(),
  entitlement: entitlementSchema.optional(),
  subscriptionRequestIdHash: sha256Schema.optional(),
  providerRequestIdHash: sha256Schema.optional(),
});

export const providerSmokeEvidenceSchema = z.discriminatedUnion("status", [
  providerSmokeBaseSchema.extend({
    status: z.literal("succeeded"),
    requestSent: z.literal(true),
    audio: z.strictObject({
      path: z.string().regex(/^diagnostics\/provider-smokes\/elevenlabs\/[A-Za-z0-9._-]+\.wav$/),
      digest: sha256Schema,
      durationSeconds: z.number().positive(),
      sampleRateHz: z.int().positive(),
      channels: z.int().positive(),
    }),
    alignmentDigest: sha256Schema,
    reportedBillableCredits: z.number().nonnegative(),
  }),
  providerSmokeBaseSchema.extend({
    status: z.literal("blocked"),
    requestSent: z.literal(false),
    reason: z.enum(["configuration", "entitlement", "provider-rejected"]),
    message: z.string().min(1).max(300),
  }),
  providerSmokeBaseSchema.extend({
    status: z.literal("failed"),
    requestSent: z.literal(true),
    reason: z.enum(["provider-rejected", "provider-timeout", "response-invalid"]),
    message: z.string().min(1).max(300),
    providerStatusCode: z.int().min(400).max(599).optional(),
    providerErrorCategory: providerSmokeErrorCategorySchema.optional(),
  }),
  providerSmokeBaseSchema.extend({
    status: z.literal("unknown"),
    requestSent: z.literal(true),
    reason: z.literal("in-progress"),
    message: z.string().min(1).max(300),
  }),
]);

export type ProviderSmokeEvidence = z.infer<typeof providerSmokeEvidenceSchema>;
export type ProviderSmokeErrorCategory = z.infer<typeof providerSmokeErrorCategorySchema>;
