import { SafeExitError } from "../../core/errors.js";
import { recordCostReservationExecutionResult } from "../../costs/costReservationService.js";
import type { CostReservationSummary } from "../../costs/costReservationStore.js";
import {
  executeReservedProviderOperation,
  type ReservedProviderAdapter,
} from "../../costs/reservedProviderExecution.js";
import { sha256 } from "../../utils/hash.js";
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
import {
  loadVoiceExecutionSpoolForOperation,
  persistVoiceExecutionSpool,
  type LoadedVoiceExecutionSpool,
} from "./voiceExecutionSpool.js";
import type { VoiceoverPreparation } from "./voiceoverPreparation.js";

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
    preparation?: { evidence: VoiceoverPreparation; evidenceText: string };
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

/**
 * Reconstructs paid voice synthesis evidence from a settled, digest-anchored execution spool.
 *
 * @param input - The settled execution spool and corresponding reservation, binding, and approved quote.
 * @returns The synthesized audio and validated paid execution evidence.
 * @throws SafeExitError If settlement is incomplete, durable evidence does not match, or billing evidence is missing.
 */
export function settledVoiceSynthesisResult(input: {
  spool: LoadedVoiceExecutionSpool;
  reservation: CostReservationSummary;
  binding: SelectedVoiceExecutionBinding;
  approvedQuote: { quoteDigest: string; approvalId: string };
}): VoiceSynthesisExecutionResult {
  const actualUsdMicros = input.reservation.actualUsdMicros;
  if (input.reservation.status !== "SETTLED" || actualUsdMicros === undefined) {
    throw new SafeExitError("Paid TTS settlement is not durably complete.");
  }
  requireMatchingSettledSpool(input.spool, {
    binding: input.binding,
    approvedQuote: input.approvedQuote,
    actualUsdMicros,
    providerRequestIdHash: input.reservation.providerRequestIdHash,
    resultEvidenceDigest: input.reservation.resultEvidenceDigest,
  });
  const billing = input.spool.audio.providerBilling;
  if (!billing) {
    throw new SafeExitError("Settled voice spool is missing provider billing evidence.");
  }
  return {
    audio: input.spool.audio,
    paidExecution: {
      schemaVersion: 1,
      bindingDigest: input.binding.bindingDigest,
      binding: input.binding,
      selection: {
        path: input.binding.selection.path,
        digest: input.binding.selection.digest,
        catalogPath: input.binding.catalog.path,
        catalogDigest: input.binding.catalog.digest,
        voiceMetadataDigest: input.binding.voice.metadataDigest,
        modelMetadataDigest: input.binding.model.metadataDigest,
        pricingDigest: input.binding.pricing.digest,
        subscriptionDigest: input.binding.subscription.digest,
      },
      liveValidation: input.spool.preflight,
      quoteDigest: input.reservation.quoteDigest,
      approvalId: input.reservation.approvalId,
      operationId: input.reservation.operationId,
      reservationId: input.reservation.reservationId,
      reservationStatus: "SETTLED",
      actualUsdMicros,
      billing,
      resultSpool: input.spool.reference,
    },
  };
}

type SpoolExecutionValue = { audio: TtsSynthesisResult; spool: LoadedVoiceExecutionSpool };

/**
 * Wraps a reserved voice provider adapter with durable result and reservation evidence recording.
 *
 * @param adapter - The provider adapter that performs voice synthesis
 * @param input - Execution identifiers and evidence required to persist the synthesis result
 * @returns An adapter that returns the synthesized audio with its persisted spool on success
 */
function spoolPaidVoiceResult(
  adapter: ReservedProviderAdapter<TtsSynthesisResult>,
  input: {
    runId: string;
    operationId: string;
    binding: SelectedVoiceExecutionBinding;
    preparation: { text: string; evidence: VoiceoverPreparation; evidenceText: string };
    approvedQuote: { quoteDigest: string; approvalId: string };
    preflight: VoiceExecutionPreflightReceipt;
  },
): ReservedProviderAdapter<SpoolExecutionValue> {
  return {
    provider: adapter.provider,
    ...(adapter.model ? { model: adapter.model } : {}),
    ...(adapter.bindingDigest ? { bindingDigest: adapter.bindingDigest } : {}),
    async execute(context) {
      const outcome = await adapter.execute(context);
      if (outcome.kind !== "success") return outcome;
      const spool = await persistVoiceExecutionSpool({
        runId: input.runId,
        operationId: input.operationId,
        binding: input.binding,
        preparation: input.preparation,
        approvedQuote: input.approvedQuote,
        preflight: input.preflight,
        actualUsdMicros: outcome.actualUsdMicros,
        providerRequestId: outcome.providerRequestId,
        audio: outcome.value,
      });
      const providerRequestIdHash = outcome.providerRequestId
        ? sha256(outcome.providerRequestId)
        : undefined;
      await recordCostReservationExecutionResult({
        runId: input.runId,
        reservationId: context.reservationId,
        actualUsdMicros: outcome.actualUsdMicros,
        providerRequestIdHash,
        resultEvidenceDigest: spool.reference.digest,
      });
      return {
        ...outcome,
        resultEvidenceDigest: spool.reference.digest,
        value: { audio: spool.audio, spool },
      };
    },
  };
}

/**
 * Validates that a settled voice execution spool matches the expected durable evidence.
 *
 * @param spool - The persisted voice execution spool to validate
 * @param expected - The reservation, binding, billing, and result evidence expected in the spool
 * @throws SafeExitError If the spool does not match the expected evidence
 */
function requireMatchingSettledSpool(
  spool: LoadedVoiceExecutionSpool,
  expected: {
    binding: SelectedVoiceExecutionBinding;
    approvedQuote: { quoteDigest: string; approvalId: string };
    actualUsdMicros: number;
    providerRequestIdHash?: string;
    resultEvidenceDigest?: string;
  },
): void {
  if (
    spool.binding.bindingDigest !== expected.binding.bindingDigest ||
    spool.approvedQuote.quoteDigest !== expected.approvedQuote.quoteDigest ||
    spool.approvedQuote.approvalId !== expected.approvedQuote.approvalId ||
    spool.actualUsdMicros !== expected.actualUsdMicros ||
    spool.providerRequestIdHash !== expected.providerRequestIdHash ||
    spool.reference.digest !== requireResultEvidenceDigest(expected.resultEvidenceDigest)
  ) {
    throw new SafeExitError("Settled voice operation does not match its durable result spool.");
  }
}

/**
 * Requires a settled voice operation to provide its result evidence digest.
 *
 * @param value - The result evidence digest to validate
 * @returns The provided result evidence digest
 */
function requireResultEvidenceDigest(value: string | undefined): string {
  if (!value) {
    throw new SafeExitError("Settled voice operation is missing its result evidence digest.");
  }
  return value;
}
