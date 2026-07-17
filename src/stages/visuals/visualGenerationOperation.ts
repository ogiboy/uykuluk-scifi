import { sha256 } from "../../utils/hash.js";

/** Creates the stable identity for one approval-bound hosted visual batch. */
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
