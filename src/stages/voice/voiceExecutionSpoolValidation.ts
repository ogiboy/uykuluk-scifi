import { createHash } from "node:crypto";

import { SafeExitError } from "../../core/errors.js";
import { sha256 } from "../../utils/hash.js";
import { splitElevenLabsText } from "./elevenLabsTextChunks.js";
import type { TtsSynthesisResult } from "./providers/ttsProvider.js";
import {
  requireMatchingVoiceExecutionInput,
  requireSelectedVoiceExecutionBinding,
  type SelectedVoiceExecutionBinding,
} from "./voiceExecutionBinding.js";
import type { VoiceExecutionSpool } from "./voiceExecutionSpoolContracts.js";
import type { VoiceoverPreparationV2 } from "./voiceoverPreparation.js";

/**
 * Requires persisted per-chunk request diagnostics to match the approved text binding and billing.
 *
 * @throws SafeExitError If chunk order, text digests, reported credits, or aggregate provider
 * billing differ from the execution binding.
 */
export function requireMatchingRequestEvidence(
  audio: TtsSynthesisResult,
  binding: SelectedVoiceExecutionBinding,
  preparedText: string,
): void {
  const chunks = splitElevenLabsText(preparedText, binding.synthesis.maxCharactersPerRequest);
  const requests = audio.providerRequests;
  if (
    requests?.length !== chunks.length ||
    requests.some(
      (request, index) =>
        request.chunkIndex !== index || request.textDigest !== sha256(chunks[index] ?? ""),
    ) ||
    requests.reduce((sum, request) => sum + request.reportedBillableCredits, 0) !==
      audio.providerBilling?.billableCredits
  ) {
    throw new SafeExitError("Paid voice request diagnostics do not match the execution binding.");
  }
}

/**
 * Validates persisted preparation content and its execution binding against a voice execution spool.
 *
 * @param spool - The voice execution spool containing expected preparation metadata.
 * @param preparation - The parsed preparation evidence to validate.
 * @param preparedText - The persisted prepared text.
 * @param evidenceText - The persisted canonical preparation evidence.
 * @throws SafeExitError If the preparation content, metadata, or binding does not match the spool.
 */
export function requireMatchingSpoolPreparation(
  spool: VoiceExecutionSpool,
  preparation: VoiceoverPreparationV2,
  preparedText: string,
  evidenceText: string,
): void {
  if (
    preparation.runId !== spool.runId ||
    preparation.output.sha256 !== spool.preparationDigest ||
    preparation.output.sha256 !== spool.preparation.text.sha256 ||
    preparation.output.characterCount !== preparedText.length ||
    `${JSON.stringify(preparation, null, 2)}\n` !== evidenceText
  ) {
    throw new SafeExitError("Voice execution spool preparation evidence is invalid.");
  }
  requireMatchingVoiceExecutionInput(spool.binding, {
    preparedText,
    preparationDigest: preparation.output.sha256,
  });
}

/**
 * Validates and returns the execution binding selected by a voice execution spool.
 *
 * @param spool - The voice execution spool whose binding and preparation digest must match
 * @returns The validated selected voice execution binding
 */
export function requireSelectedSpoolBinding(
  spool: VoiceExecutionSpool,
): SelectedVoiceExecutionBinding {
  const binding = requireSelectedVoiceExecutionBinding(spool.binding);
  if (binding.input.preparedTextDigest !== spool.preparationDigest) {
    throw new SafeExitError("Voice execution spool preparation digest does not match its binding.");
  }
  return binding;
}

/**
 * Validates that a synthesized voice result matches its execution binding and recorded cost.
 *
 * @param audio - The synthesized voice result to validate
 * @param binding - The execution binding the result must match
 * @param actualUsdMicros - The recorded cost in millionths of a US dollar
 */
export function requireSpoolableAudio(
  audio: TtsSynthesisResult,
  binding: SelectedVoiceExecutionBinding,
  actualUsdMicros: number,
): void {
  if (
    audio.quality !== "elevenlabs" ||
    audio.outputAlreadyPersisted ||
    !audio.alignment ||
    audio.providerBilling?.baseUsdPerThousandBillableCredits !==
      binding.pricing.baseUsdPerThousandCharacters ||
    audio.providerBilling.derivedUsdMicros !== actualUsdMicros ||
    audio.provider?.service !== "elevenlabs" ||
    audio.provider.modelId !== binding.model.modelId ||
    audio.provider.voiceId !== binding.voice.voiceId ||
    audio.provider.outputFormat !== binding.synthesis.outputFormat
  ) {
    throw new SafeExitError("Paid voice result does not match its execution binding.");
  }
}

/**
 * Computes the SHA-256 digest of binary data.
 *
 * @param value - The data to hash
 * @returns The digest as a lowercase hexadecimal string
 */
export function sha256Buffer(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}
