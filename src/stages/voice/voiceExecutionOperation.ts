import { sha256 } from "../../utils/hash.js";

/**
 * Creates a stable operation identifier for a paid text-to-speech execution.
 *
 * @param input - The run, preparation, binding, quote, and approval identifiers used to derive the operation ID
 * @returns An operation ID prefixed with `tts_`
 */
export function createVoiceExecutionOperationId(input: {
  runId: string;
  preparationDigest: string;
  bindingDigest: string;
  quoteDigest: string;
  approvalId: string;
}): string {
  return `tts_${sha256(
    JSON.stringify({
      runId: input.runId,
      preparationDigest: input.preparationDigest,
      bindingDigest: input.bindingDigest,
      quoteDigest: input.quoteDigest,
      approvalId: input.approvalId,
    }),
  )}`;
}
