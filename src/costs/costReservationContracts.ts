import { z } from "zod";
import { costBindingSummarySchema, type CostBindingSummary } from "./costBindingSummary.js";
import { executionBindingDigestSchema } from "./providerAdapterIdentity.js";
import {
  providerRequestEvidenceSchema,
  type ProviderRequestEvidence,
} from "./providerRequestEvidence.js";

const providerRequestIdHashSchema = z.string().regex(/^[a-f0-9]{64}$/);

const reservationBaseSchema = z.strictObject({
  eventId: z.string().min(1),
  reservationId: z.string().min(1),
  runId: z.string().min(1),
  createdAt: z.iso.datetime(),
});

const reservedEventSchema = reservationBaseSchema.extend({
  type: z.literal("RESERVED"),
  operationId: z.string().min(1),
  approvalId: z.string().min(1),
  quoteDigest: z.string().regex(/^[a-f0-9]{64}$/),
  stage: z.string().min(1),
  provider: z.string().min(1),
  model: z.string().min(1).optional(),
  bindingDigest: executionBindingDigestSchema.optional(),
  bindingSummary: costBindingSummarySchema.optional(),
  maxUsdMicros: z.int().nonnegative(),
});

const executionStartedEventSchema = reservationBaseSchema.extend({
  type: z.literal("EXECUTION_STARTED"),
  provider: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  bindingDigest: executionBindingDigestSchema.optional(),
});

const settlementEventSchema = reservationBaseSchema.extend({
  type: z.enum(["SETTLEMENT_PENDING", "SETTLED"]),
  actualUsdMicros: z.int().nonnegative(),
  providerRequestIdHash: providerRequestIdHashSchema.optional(),
  resultEvidenceDigest: executionBindingDigestSchema.optional(),
});

const reasonEventSchema = reservationBaseSchema.extend({
  type: z.enum(["RELEASED", "UNCERTAIN", "RECONCILED_RELEASED"]),
  reason: z.string().min(1),
  providerRequestIdHash: providerRequestIdHashSchema.optional(),
  requestEvidence: providerRequestEvidenceSchema.optional(),
});

const reconciledSettledEventSchema = reservationBaseSchema.extend({
  type: z.literal("RECONCILED_SETTLED"),
  actualUsdMicros: z.int().nonnegative(),
  reason: z.string().min(1),
});

export const costReservationEventSchema = z.discriminatedUnion("type", [
  reservedEventSchema,
  executionStartedEventSchema,
  settlementEventSchema,
  reasonEventSchema,
  reconciledSettledEventSchema,
]);

export type CostReservationEvent = z.infer<typeof costReservationEventSchema>;
export type CostReservationStatus =
  "RESERVED" | "EXECUTION_STARTED" | "SETTLEMENT_PENDING" | "SETTLED" | "RELEASED" | "UNCERTAIN";

export type CostReservationSummary = {
  reservationId: string;
  runId: string;
  operationId: string;
  approvalId: string;
  quoteDigest: string;
  stage: string;
  provider: string;
  model?: string;
  bindingDigest?: string;
  bindingSummary?: CostBindingSummary;
  maxUsdMicros: number;
  status: CostReservationStatus;
  actualUsdMicros?: number;
  executionStartedAt?: string;
  providerRequestIdHash?: string;
  requestEvidence?: ProviderRequestEvidence;
  resultEvidenceDigest?: string;
  reason?: string;
  reservedAt: string;
  updatedAt: string;
};
