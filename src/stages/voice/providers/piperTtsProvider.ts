import { spawn } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { artifactPath } from "../../../core/artifacts.js";
import { SafeExitError } from "../../../core/errors.js";
import { ensureDir } from "../../../utils/fs.js";
import { readPiperProviderEvidence } from "../piperProviderEvidence.js";
import { voiceoverAudioPath } from "../voiceoverPaths.js";
import { normalizePcm16WavPeak, readWavInfo } from "../voiceWav.js";
import type { TtsProvider, TtsSynthesisInput, TtsSynthesisResult } from "./ttsProvider.js";

export type PiperTtsProviderConfig = { binary: string; configPath?: string; modelPath?: string };

/** Local Piper adapter. The final output remains inside the canonical run artifact path. */
export class PiperTtsProvider implements TtsProvider {
  readonly mode = "local-piper" as const;

  constructor(private readonly config: PiperTtsProviderConfig) {}

  async synthesize(input: TtsSynthesisInput): Promise<TtsSynthesisResult> {
    const provider = await readPiperProviderEvidence(this.config);
    const output = artifactPath(input.runId, voiceoverAudioPath);
    await ensureDir(path.dirname(output));
    await rm(output, { force: true }).catch(() => undefined);
    const args = ["--model", provider.modelPath, "--output_file", output];
    if (provider.configPath) {
      args.push("--config", provider.configPath);
    }
    await runPiper(this.config.binary, args, input.text);
    const sourceBuffer = await readFile(output);
    const normalized = normalizePcm16WavPeak(sourceBuffer);
    if (normalized.evidence.applied) {
      await writeFile(output, normalized.buffer);
    }
    const wav = readWavInfo(normalized.buffer);
    return {
      buffer: normalized.buffer,
      channels: wav.channels,
      durationSeconds: wav.durationSeconds,
      outputAlreadyPersisted: true,
      provider,
      processing: { peakNormalization: normalized.evidence },
      quality: "local-piper",
      sampleRateHz: wav.sampleRateHz,
    };
  }
}

async function runPiper(binary: string, args: string[], input: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ["pipe", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) =>
      reject(new SafeExitError(`Piper failed to start: ${error.message}`)),
    );
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new SafeExitError(`Piper exited with code ${code}: ${stderr.trim()}`));
    });
    child.stdin.end(input.endsWith("\n") ? input : `${input}\n`);
  });
}
