import { SafeExitError } from "../../core/errors.js";
import { executeReservedProviderOperation } from "../../costs/reservedProviderExecution.js";
import type {
  TtsProvider,
  TtsSynthesisInput,
  TtsSynthesisResult,
} from "./providers/ttsProvider.js";
import {
  requireMatchingVoiceExecutionInput,
  type SelectedVoiceExecutionBinding,
} from "./voiceExecutionBinding.js";
import type { PaidVoiceExecutionEvidence } from "./voiceExecutionEvidence.js";
import { createVoiceExecutionOperationId } from "./voiceExecutionOperation.js";
import {
  requireMatchingVoiceExecutionPreflight,
  type VoiceExecutionPreflightReceipt,
} from "./voiceExecutionPreflight.js";
import { loadVoiceExecutionSpoolForOperation } from "./voiceExecutionSpool.js";
import {
  requireResultEvidenceDigest,
  settledVoiceSynthesisResult,
  spoolPaidVoiceResult,
} from "./voiceSynthesisSettlement.js";
import type { VoiceoverPreparationV2 } from "./voiceoverPreparation.js";

export { settledVoiceSynthesisResult } from "./voiceSynthesisSettlement.js";

export type VoiceSynthesisExecutionResult = {
  audio: TtsSynthesisResult;
  paidExecution?: PaidVoiceExecutionEvidence;
};

/**
 * Executes local synthesis or one reservation-bound paid synthesis operation.
 *
 * @param provider - The TTS provider used for synthesis.
 * @param input - The synthesis input, including the text and run identifier.
 * @param options - Validation evidence and execution settings for paid synthesis.
 * @returns The synthesized audio and, for paid execution, its settlement evidence.
 */
export async function synthesizeVoiceover(
  provider: TtsProvider,
  input: TtsSynthesisInput,
  options: {
    preparationDigest: string;
    binding?: SelectedVoiceExecutionBinding;
    preflight?: VoiceExecutionPreflightReceipt;
    approvedQuote?: { quoteDigest: string; approvalId: string };
    afterResultCommitted?: () => Promise<void>;
    preparation?: { evidence: VoiceoverPreparationV2; evidenceText: string };
  },
): Promise<VoiceSynthesisExecutionResult> {
  if (provider.executionPolicy === "local") {
    return { audio: await provider.synthesize(input) };
  }
  if (!options.binding || !options.preflight || !options.approvedQuote) {
    throw new SafeExitError("Paid TTS execution requires a current live-selected voice preflight.");
  }
  if (!options.preparation) {
    throw new SafeExitError("Paid TTS execution requires exact prepared-text evidence.");
  }
  const binding = requireMatchingVoiceExecutionInput(options.binding, {
    preparedText: input.text,
    preparationDigest: options.preparationDigest,
  });
  const preflight = requireMatchingVoiceExecutionPreflight(options.preflight, binding);
  provider.assertReady();
  const operationId = createVoiceExecutionOperationId({
    runId: input.runId,
    preparationDigest: options.preparationDigest,
    bindingDigest: binding.bindingDigest,
    quoteDigest: options.approvedQuote.quoteDigest,
    approvalId: options.approvedQuote.approvalId,
  });
  const result = await executeReservedProviderOperation({
    runId: input.runId,
    stage: "tts",
    operationId,
    timeoutMs: binding.synthesis.timeoutMs,
    adapter: spoolPaidVoiceResult(provider.createReservedAdapter(input), {
      runId: input.runId,
      operationId,
      binding,
      approvedQuote: options.approvedQuote,
      preflight,
      preparation: {
        text: input.text,
        evidence: options.preparation.evidence,
        evidenceText: options.preparation.evidenceText,
      },
    }),
    afterSuccessfulExecutionCommitted: options.afterResultCommitted,
  });
  if (result.status === "completed" || result.status === "already-completed") {
    const spool =
      result.status === "completed"
        ? result.value.spool
        : await loadVoiceExecutionSpoolForOperation(
            input.runId,
            operationId,
            requireResultEvidenceDigest(result.reservation.resultEvidenceDigest),
          );
    return settledVoiceSynthesisResult({
      spool,
      reservation: result.reservation,
      binding,
      approvedQuote: options.approvedQuote,
    });
  }
  if (result.status === "definitely-not-sent") {
    throw new SafeExitError(
      "ElevenLabs TTS was not sent; repair provider configuration and create a fresh cost quote before retrying.",
    );
  }
  throw new SafeExitError(
    "ElevenLabs TTS reservation requires reconciliation before retry; automatic duplicate generation is blocked.",
  );
}
