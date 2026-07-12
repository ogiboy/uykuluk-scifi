import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { SafeExitError } from "../../core/errors.js";
import { pathExists } from "../../utils/fs.js";

export type PiperProviderEvidence = {
  binary: string;
  configPath?: string;
  configSha256?: string;
  modelPath: string;
  modelSha256: string;
};

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

  const provider: PiperProviderEvidence = {
    binary: options.binary,
    modelPath: options.modelPath,
    modelSha256: await sha256File(options.modelPath),
  };

  if (!options.configPath) {
    return provider;
  }
  if (!(await pathExists(options.configPath))) {
    throw new SafeExitError(`Piper model config is missing: ${options.configPath}.`);
  }

  return {
    ...provider,
    configPath: options.configPath,
    configSha256: await sha256File(options.configPath),
  };
}

async function sha256File(target: string): Promise<string> {
  const hash = createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(target);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolve);
  });
  return hash.digest("hex");
}
