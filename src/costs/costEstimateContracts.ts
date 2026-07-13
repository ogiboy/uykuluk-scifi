import { z } from "zod";
import { costBindingSummarySchema } from "./costBindingSummary.js";
import { executionBindingDigestSchema } from "./providerAdapterIdentity.js";

const budgetSnapshotSchema = z.strictObject({
  perVideoUsd: z.number().nonnegative(),
  dailyUsd: z.number().nonnegative(),
  weeklyUsd: z.number().nonnegative(),
  requireApprovalAboveUsd: z.number().nonnegative(),
});

const quotedStageSchema = z.strictObject({
  stage: z.string().min(1),
  provider: z.string().min(1),
  model: z.string().min(1).optional(),
  bindingDigest: executionBindingDigestSchema.optional(),
  bindingSummary: costBindingSummarySchema.optional(),
  enabled: z.boolean(),
  estimatedUsd: z.number().nonnegative(),
});

export const costEstimateSchema = z.strictObject({
  schemaVersion: z.literal(1),
  runId: z.string().min(1),
  generatedAt: z.iso.datetime(),
  currency: z.literal("USD"),
  stages: z.array(quotedStageSchema),
  estimatedStageCost: z.number().nonnegative(),
  cumulativeEstimatedRunCost: z.number().nonnegative(),
  budgets: budgetSnapshotSchema,
  budgetAllowed: z.boolean(),
  approvalRequired: z.boolean(),
  hardBlockedReasons: z.array(z.string()),
  nextStepAllowed: z.boolean(),
  blockedReasons: z.array(z.string()),
  productionPackageDigest: z.string().regex(/^[a-f0-9]{64}$/),
  configDigest: z.string().regex(/^[a-f0-9]{64}$/),
  pricingDigest: z.string().regex(/^[a-f0-9]{64}$/),
});

export type CostEstimate = z.infer<typeof costEstimateSchema>;
