import type { ProducerConfig } from "../../../config/schema.js";
import { SafeExitError } from "../../../core/errors.js";
import type { VoiceCandidate, VoiceCandidates } from "./voiceCatalogContracts.js";

/**
 * Validates the persisted voice catalog against the configured ElevenLabs settings.
 *
 * @param config - Producer configuration containing the ElevenLabs TTS settings
 * @param catalog - Persisted voice catalog to validate
 * @returns The validated ElevenLabs TTS settings
 * @throws SafeExitError If ElevenLabs TTS is not enabled or the catalog is incompatible with the configured model, language, request size, or pricing
 */
export function requireElevenLabsCatalogConfig(
  config: ProducerConfig,
  catalog: VoiceCandidates,
): ProducerConfig["providers"]["tts"]["elevenLabs"] {
  const tts = config.providers.tts;
  if (!tts.enabled || tts.mode !== "elevenlabs") {
    throw new SafeExitError("Voice audition requires explicitly enabled ElevenLabs TTS.");
  }
  const settings = tts.elevenLabs;
  if (catalog.provider !== "elevenlabs" || catalog.model.modelId !== settings.modelId) {
    throw new SafeExitError("Voice catalog does not match the current ElevenLabs model.");
  }
  if (!catalog.model.languages.includes(settings.languageCode)) {
    throw new SafeExitError("Voice catalog model no longer proves Turkish support.");
  }
  if (settings.maxCharactersPerRequest > catalog.model.maximumTextLengthPerRequest) {
    throw new SafeExitError("Current ElevenLabs chunk size exceeds the catalog model limit.");
  }
  if (catalog.pricing.baseUsdPerThousandCharacters !== settings.usdPerThousandCharacters) {
    throw new SafeExitError(
      "Voice catalog pricing does not match the current configured base rate.",
    );
  }
  return settings;
}

/**
 * Locates and validates a voice candidate from the persisted catalog.
 *
 * @param voiceId - The identifier of the voice candidate to select
 * @param nowMs - The current time in milliseconds, used to evaluate whether sharing is disabled
 * @returns The validated voice candidate
 */
export function requireCatalogCandidate(
  catalog: VoiceCandidates,
  voiceId: string,
  nowMs: number = Date.now(),
): VoiceCandidate {
  const candidate = catalog.candidates.find((item) => item.voiceId === voiceId);
  if (!candidate) {
    throw new SafeExitError("Selected voice is not present in the current persisted catalog.");
  }
  if (
    !candidate.preview.available ||
    !candidate.preview.urlSha256 ||
    (candidate.preview.sourceClass !== "elevenlabs" &&
      candidate.preview.sourceClass !== "eleven-public-prod")
  ) {
    throw new SafeExitError("Selected voice has no approved bounded preview source.");
  }
  if (
    candidate.sharing?.disableAtUnix !== undefined &&
    candidate.sharing.disableAtUnix <= Math.floor(nowMs / 1_000)
  ) {
    throw new SafeExitError("Selected voice is disabled; refresh the provider catalog.");
  }
  return candidate;
}
