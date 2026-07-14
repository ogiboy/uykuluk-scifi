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
  hostedVoiceExecutionConfirmationMatches,
  type HostedVoiceExecutionConfirmation,
} from "./voiceExecutionConfirmation.js";
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

/**
 * Prepares a text-to-speech provider and validates ElevenLabs execution prerequisites.
 *
 * @param input - Run, provider configuration, prepared text, and optional metadata provider used for execution preflight.
 * @returns The prepared provider, with binding, preflight receipt, and approved quote details for ElevenLabs execution.
 * @throws SafeExitError If the approved quote cannot be validated, does not match the selected binding, or execution preflight fails.
 */
export async function prepareVoiceExecution(input: {
  runId: string;
  config: ProducerConfig;
  preparedText: string;
  confirmation?: HostedVoiceExecutionConfirmation;
  metadataProvider?: VoiceExecutionMetadataProvider;
}): Promise<PreparedVoiceExecution> {
  if (input.config.providers.tts.mode !== "elevenlabs") {
    if (input.confirmation) {
      throw new SafeExitError(
        "Hosted voice execution confirmation is only valid for ElevenLabs production voice.",
      );
    }
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
  if (
    !input.confirmation ||
    !hostedVoiceExecutionConfirmationMatches(input.confirmation, {
      approvalId: approved.approvalId,
      bindingDigest: binding.bindingDigest,
      quoteDigest: approved.quoteDigest,
    })
  ) {
    await appendLedgerEvent({
      runId: input.runId,
      type: "GUARD_BLOCKED",
      stage: "voice-execution-preflight",
      message: input.confirmation
        ? "Hosted voice execution confirmation is stale or does not match the active quote."
        : "Hosted voice execution requires exact paid-operation confirmation.",
      data: {
        reason: input.confirmation
          ? "hosted-execution-confirmation-mismatch"
          : "hosted-execution-confirmation-missing",
        approvalId: approved.approvalId,
        quoteDigest: approved.quoteDigest,
        bindingDigest: binding.bindingDigest,
      },
    });
    throw new SafeExitError(
      input.confirmation
        ? "ElevenLabs production voice confirmation is stale. Refresh the run and confirm the current approved quote."
        : "ElevenLabs production voice requires explicit confirmation of the current binding, quote, and approval.",
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
