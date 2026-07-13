import { spawn } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { artifactPath } from "../../../core/artifacts.js";
import { SafeExitError } from "../../../core/errors.js";
import { ensureDir, writeBinaryFile } from "../../../utils/fs.js";
import { readPiperProviderEvidence } from "../piperProviderEvidence.js";
import { voiceoverAudioPath } from "../voiceoverPaths.js";
import { normalizePcm16WavPeak, readWavInfo } from "../voiceWav.js";
import type { LocalTtsProvider, TtsSynthesisInput, TtsSynthesisResult } from "./ttsProvider.js";

export type PiperTtsProviderConfig = {
  binary: string;
  configPath?: string;
  modelPath?: string;
  timeoutMs?: number;
};

const defaultPiperTimeoutMs = 300_000;

/** Local Piper adapter. The final output remains inside the canonical run artifact path. */
export class PiperTtsProvider implements LocalTtsProvider {
  readonly mode = "local-piper" as const;
  readonly executionPolicy = "local" as const;

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
    try {
      await runPiper(
        this.config.binary,
        args,
        input.text,
        this.config.timeoutMs ?? defaultPiperTimeoutMs,
      );
    } catch (error) {
      await rm(output, { force: true }).catch(() => undefined);
      throw error;
    }
    const sourceBuffer = await readFile(output);
    const normalized = normalizePcm16WavPeak(sourceBuffer);
    if (normalized.evidence.applied) {
      await writeBinaryFile(output, normalized.buffer);
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

/**
 * Runs Piper with the provided input and arguments, enforcing an execution timeout.
 *
 * @param binary - Path to the Piper executable
 * @param args - Arguments passed to Piper
 * @param input - Text provided to Piper for synthesis
 * @param timeoutMs - Maximum execution time in milliseconds
 */
async function runPiper(
  binary: string,
  args: string[],
  input: string,
  timeoutMs: number,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ["pipe", "ignore", "pipe"] });
    let stderr = "";
    let settled = false;
    let timedOut = false;
    let forceKill: ReturnType<typeof setTimeout> | undefined;
    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (forceKill) clearTimeout(forceKill);
      callback();
    };
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      forceKill = setTimeout(() => child.kill("SIGKILL"), 100);
    }, timeoutMs);
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      if (timedOut) {
        settle(() =>
          reject(new SafeExitError(`Piper timed out after ${timeoutMs}ms and was terminated.`)),
        );
        return;
      }
      settle(() => reject(new SafeExitError(`Piper failed to start: ${error.message}`)));
    });
    child.on("close", (code) => {
      if (timedOut) {
        settle(() =>
          reject(new SafeExitError(`Piper timed out after ${timeoutMs}ms and was terminated.`)),
        );
        return;
      }
      if (code === 0) {
        settle(resolve);
        return;
      }
      settle(() =>
        reject(new SafeExitError(`Piper exited with code ${code}: ${stderr.trim()}`)),
      );
    });
    child.stdin.end(input.endsWith("\n") ? input : `${input}\n`);
  });
}
