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

/**
 * Verifies that an operator confirmation authorizes the active execution plan and quote.
 *
 * @param confirmation - The operator confirmation to verify.
 * @param expected - The active approval, binding, and quote identifiers.
 * @returns `true` if paid-operation confirmation is enabled and all expected identifiers match, `false` otherwise.
 */
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
