import { sha256 } from "../../utils/hash.js";

/**
 * Creates a stable identifier for an approval-bound hosted visual generation batch.
 *
 * @param input - Identifying values for the run, plan, quote, and approval.
 * @returns An identifier prefixed with `image_` and derived from the supplied values.
 */
export function createHostedVisualGenerationOperationId(input: {
  runId: string;
  planDigest: string;
  quoteDigest: string;
  approvalId: string;
}): string {
  return `image_${sha256(
    JSON.stringify({
      runId: input.runId,
      planDigest: input.planDigest,
      quoteDigest: input.quoteDigest,
      approvalId: input.approvalId,
    }),
  )}`;
}
