import { z } from "zod";

import { sha256Schema } from "./catalog/voiceCatalogContracts.js";

export const hostedVoiceExecutionConfirmationSchema = z.strictObject({
  approvalId: z.string().trim().min(1).max(200),
  bindingDigest: sha256Schema,
  confirmPaidOperation: z.literal(true),
  quoteDigest: sha256Schema,
});

/** Exact operator confirmation required before a new hosted voice synthesis request. */
export type HostedVoiceExecutionConfirmation = z.infer<
  typeof hostedVoiceExecutionConfirmationSchema
>;

/** Returns whether the browser or CLI confirmation still identifies the active binding and quote. */
export function hostedVoiceExecutionConfirmationMatches(
  confirmation: HostedVoiceExecutionConfirmation,
  expected: Readonly<{ approvalId: string; bindingDigest: string; quoteDigest: string }>,
): boolean {
  return (
    confirmation.confirmPaidOperation &&
    confirmation.approvalId === expected.approvalId &&
    confirmation.bindingDigest === expected.bindingDigest &&
    confirmation.quoteDigest === expected.quoteDigest
  );
}
