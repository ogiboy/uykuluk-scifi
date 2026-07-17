import { z } from "zod";
import { digestSchema } from "../render/renderPlanSchemas.js";

export const hostedVisualExecutionConfirmationSchema = z.strictObject({
  approvalId: z.string().trim().min(1).max(200),
  bindingDigest: digestSchema,
  confirmPaidOperation: z.literal(true),
  quoteDigest: digestSchema,
});

/** Exact operator confirmation required before a hosted visual batch is submitted. */
export type HostedVisualExecutionConfirmation = z.infer<
  typeof hostedVisualExecutionConfirmationSchema
>;

/** Returns whether confirmation still identifies the active plan, quote, and approval. */
export function hostedVisualExecutionConfirmationMatches(
  confirmation: HostedVisualExecutionConfirmation,
  expected: Readonly<{ approvalId: string; bindingDigest: string; quoteDigest: string }>,
): boolean {
  return (
    confirmation.confirmPaidOperation &&
    confirmation.approvalId === expected.approvalId &&
    confirmation.bindingDigest === expected.bindingDigest &&
    confirmation.quoteDigest === expected.quoteDigest
  );
}
