import type { ProducerConfig } from "../../../config/schema.js";
import { SafeExitError } from "../../../core/errors.js";
import {
  elevenLabsConfigFromBinding,
  type SelectedVoiceExecutionBinding,
} from "../voiceExecutionBinding.js";
import { DeterministicReferenceTtsProvider } from "./deterministicReferenceTtsProvider.js";
import { ElevenLabsTtsProvider } from "./elevenLabsTtsProvider.js";
import { PiperTtsProvider } from "./piperTtsProvider.js";
import type { TtsProvider } from "./ttsProvider.js";

/**
 * Creates the TTS provider selected by the configuration.
 *
 * @param config - TTS provider configuration.
 * @param binding - Selected voice binding required for ElevenLabs.
 * @returns The configured TTS provider.
 * @throws SafeExitError If ElevenLabs is selected without a voice binding or if the TTS mode is unsupported.
 */
export function createTtsProvider(
  config: ProducerConfig["providers"]["tts"],
  binding?: SelectedVoiceExecutionBinding,
): TtsProvider {
  switch (config.mode) {
    case "deterministic-local":
      return new DeterministicReferenceTtsProvider();
    case "local-piper":
      return new PiperTtsProvider({
        binary: config.piperBinary ?? "piper",
        configPath: config.piperConfigPath,
        modelPath: config.piperModelPath,
      });
    case "elevenlabs":
      if (!binding) {
        throw new SafeExitError(
          "ElevenLabs production TTS requires a current selected voice binding.",
        );
      }
      return new ElevenLabsTtsProvider(elevenLabsConfigFromBinding(config, binding));
    default: {
      const unsupportedMode: never = config.mode;
      throw new SafeExitError(`Unsupported TTS mode: ${String(unsupportedMode)}.`);
    }
  }
}
