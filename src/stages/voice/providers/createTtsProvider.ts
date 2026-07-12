import type { ProducerConfig } from "../../../config/schema.js";
import { DeterministicReferenceTtsProvider } from "./deterministicReferenceTtsProvider.js";
import { PiperTtsProvider } from "./piperTtsProvider.js";
import type { TtsProvider } from "./ttsProvider.js";

/** Resolves the configured TTS engine without changing workflow or approval behavior. */
export function createTtsProvider(config: ProducerConfig["providers"]["tts"]): TtsProvider {
  if (config.mode === "deterministic-local") {
    return new DeterministicReferenceTtsProvider();
  }
  return new PiperTtsProvider({
    binary: config.piperBinary ?? "piper",
    configPath: config.piperConfigPath,
    modelPath: config.piperModelPath,
  });
}
