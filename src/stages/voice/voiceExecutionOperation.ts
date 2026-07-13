import { sha256 } from "../../utils/hash.js";

/** Derives the stable paid-TTS operation id from one exact quote approval and execution binding. */
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
