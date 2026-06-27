import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { SafeExitError } from "../core/errors.js";
import { pathExists } from "../utils/fs.js";
import type { VoiceoverAudioMeta } from "./voiceoverEvidence.js";

export type PiperProviderEvidence = NonNullable<VoiceoverAudioMeta["provider"]>;

/**
 * Builds Piper provider evidence from the model and optional config files.
 *
 * @param options - Piper provider paths and binary identifier
 * @returns Provider evidence containing the model hash and, when provided, the config hash
 */
export async function readPiperProviderEvidence(options: {
  binary: string;
  configPath?: string;
  modelPath?: string;
}): Promise<PiperProviderEvidence> {
  if (!options.modelPath) {
    throw new SafeExitError("local-piper TTS requires providers.tts.piperModelPath.");
  }
  if (!(await pathExists(options.modelPath))) {
    throw new SafeExitError(`Piper model is missing: ${options.modelPath}.`);
  }

  const modelBuffer = await readFile(options.modelPath);
  const provider: PiperProviderEvidence = {
    binary: options.binary,
    modelPath: options.modelPath,
    modelSha256: createHash("sha256").update(modelBuffer).digest("hex"),
  };

  if (!options.configPath) {
    return provider;
  }
  if (!(await pathExists(options.configPath))) {
    throw new SafeExitError(`Piper model config is missing: ${options.configPath}.`);
  }

  const configBuffer = await readFile(options.configPath);
  return {
    ...provider,
    configPath: options.configPath,
    configSha256: createHash("sha256").update(configBuffer).digest("hex"),
  };
}
