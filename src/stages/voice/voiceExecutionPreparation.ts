import type { ProducerConfig } from "../../config/schema.js";
import { SafeExitError } from "../../core/errors.js";
import { appendLedgerEvent } from "../../core/ledger.js";
import { loadApprovedQuoteLine } from "../../costs/costReservationContext.js";
import { createTtsProvider } from "./providers/createTtsProvider.js";
import type { TtsProvider } from "./providers/ttsProvider.js";
import {
  buildSelectedVoiceExecutionBinding,
  type SelectedVoiceExecutionBinding,
} from "./voiceExecutionBinding.js";
import {
  revalidateSelectedVoiceExecutionBinding,
  type VoiceExecutionMetadataProvider,
  type VoiceExecutionPreflightReceipt,
} from "./voiceExecutionPreflight.js";

export type PreparedVoiceExecution = {
  provider: TtsProvider;
  binding?: SelectedVoiceExecutionBinding;
  preflight?: VoiceExecutionPreflightReceipt;
  approvedQuote?: { quoteDigest: string; approvalId: string };
};

/** Resolves local TTS directly or proves the exact approved paid binding before live metadata GETs. */
export async function prepareVoiceExecution(input: {
  runId: string;
  config: ProducerConfig;
  preparedText: string;
  metadataProvider?: VoiceExecutionMetadataProvider;
}): Promise<PreparedVoiceExecution> {
  if (input.config.providers.tts.mode !== "elevenlabs") {
    return { provider: createTtsProvider(input.config.providers.tts) };
  }
  const binding = await buildSelectedVoiceExecutionBinding({
    runId: input.runId,
    config: input.config,
    preparedText: input.preparedText,
  });
  let approved: Awaited<ReturnType<typeof loadApprovedQuoteLine>>;
  try {
    approved = await loadApprovedQuoteLine(input.runId, "tts");
  } catch (error) {
    await appendLedgerEvent({
      runId: input.runId,
      type: "GUARD_BLOCKED",
      stage: "voice-execution-preflight",
      message: "Approved TTS quote validation failed before provider execution.",
      data: {
        reason: "approved-quote-validation-failed",
        currentProvider: binding.provider,
        currentModel: binding.model.modelId,
        currentBindingDigest: binding.bindingDigest,
      },
    });
    if (error instanceof SafeExitError) {
      throw error;
    }
    throw new SafeExitError("Approved TTS quote validation failed safely.");
  }
  if (
    approved.provider !== binding.provider ||
    approved.model !== binding.model.modelId ||
    approved.bindingDigest !== binding.bindingDigest
  ) {
    await appendLedgerEvent({
      runId: input.runId,
      type: "GUARD_BLOCKED",
      stage: "voice-execution-preflight",
      message: "Approved TTS quote does not match the current selected voice binding.",
      data: {
        approvalId: approved.approvalId,
        quoteDigest: approved.quoteDigest,
        approvedProvider: approved.provider,
        approvedModel: approved.model,
        approvedBindingDigest: approved.bindingDigest,
        currentProvider: binding.provider,
        currentModel: binding.model.modelId,
        currentBindingDigest: binding.bindingDigest,
      },
    });
    throw new SafeExitError(
      "Approved TTS quote does not match the current selected voice binding.",
    );
  }
  let preflight: VoiceExecutionPreflightReceipt;
  try {
    preflight = await revalidateSelectedVoiceExecutionBinding({
      binding,
      provider: input.metadataProvider,
    });
  } catch (error) {
    await appendLedgerEvent({
      runId: input.runId,
      type: "GUARD_BLOCKED",
      stage: "voice-execution-preflight",
      message: "ElevenLabs live execution preflight blocked before reservation.",
      data: {
        bindingDigest: binding.bindingDigest,
        provider: binding.provider,
        model: binding.model.modelId,
      },
    });
    if (error instanceof SafeExitError) {
      throw error;
    }
    throw new SafeExitError("ElevenLabs execution metadata refresh failed safely.");
  }
  return {
    binding,
    preflight,
    approvedQuote: { quoteDigest: approved.quoteDigest, approvalId: approved.approvalId },
    provider: createTtsProvider(input.config.providers.tts, binding),
  };
}
