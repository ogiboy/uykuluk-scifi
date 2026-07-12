import type { ProducerConfig } from "../../../config/schema.js";
import { DeterministicReferenceTtsProvider } from "./deterministicReferenceTtsProvider.js";
import { ElevenLabsTtsProvider } from "./elevenLabsTtsProvider.js";
import { PiperTtsProvider } from "./piperTtsProvider.js";
import type { TtsProvider } from "./ttsProvider.js";

/** Resolves the configured TTS engine without changing workflow or approval behavior. */
export function createTtsProvider(config: ProducerConfig["providers"]["tts"]): TtsProvider {
  if (config.mode === "deterministic-local") {
    return new DeterministicReferenceTtsProvider();
  }
  if (config.mode === "local-piper") {
    return new PiperTtsProvider({
      binary: config.piperBinary ?? "piper",
      configPath: config.piperConfigPath,
      modelPath: config.piperModelPath,
    });
  }
  return new ElevenLabsTtsProvider({
    voiceId: config.elevenLabs.voiceId ?? "",
    modelId: config.elevenLabs.modelId,
    outputFormat: config.elevenLabs.outputFormat,
    timeoutMs: config.elevenLabs.timeoutMs,
    maxRetries: config.elevenLabs.maxRetries,
    usdPerThousandCharacters: config.elevenLabs.usdPerThousandCharacters,
    voiceSettings: config.elevenLabs.voiceSettings,
  });
}
