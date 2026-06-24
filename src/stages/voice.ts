import { createHash } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { loadConfig } from "../config/config.js";
import {
  artifactPath,
  recordRunArtifact,
  writeRunBinary,
  writeRunJson,
} from "../core/artifacts.js";
import { SafeExitError } from "../core/errors.js";
import { appendLedgerEvent } from "../core/ledger.js";
import { loadRun, saveRun } from "../core/runStore.js";
import { requireApproval, requireState } from "../safeguards/approvalGuard.js";
import { ensureDir, pathExists } from "../utils/fs.js";
import { nowIso } from "../utils/time.js";
import { verifyProductionPackage } from "./productionPackageIntegrity.js";
import { readRenderPlanEvidence } from "./renderPlan.js";
import {
  VoiceoverAudioMeta,
  voiceoverAudioMetaPath,
  voiceoverAudioPath,
  voiceoverAudioMetaSchema,
} from "./voiceoverEvidence.js";

type SynthesizedAudio = {
  buffer: Buffer;
  channels: number;
  durationSeconds: number;
  provider?: VoiceoverAudioMeta["provider"];
  quality: VoiceoverAudioMeta["quality"];
  sampleRateHz: number;
};

export async function generateVoiceoverAudio(runId: string): Promise<VoiceoverAudioMeta> {
  const config = await loadConfig();
  let run = await loadRun(runId);
  if (!config.providers.tts.enabled) {
    await appendLedgerEvent({
      runId: run.runId,
      type: "GUARD_BLOCKED",
      stage: "voice",
      message: "Voice/TTS is disabled until local TTS configuration is explicitly enabled.",
    });
    throw new SafeExitError("Voice/TTS is disabled and requires explicit local TTS configuration.");
  }

  await requireState(run, "READY_FOR_MANUAL_PRODUCTION", "voice");
  await requireApproval(run, "script", "voice");
  await verifyProductionPackage(run);
  const renderPlan = await readRenderPlanEvidence(run);
  if (renderPlan.status !== "pass") {
    await appendLedgerEvent({
      runId: run.runId,
      type: "GUARD_BLOCKED",
      stage: "voice",
      message: `Voice/TTS requires a valid render plan: ${renderPlan.status}.`,
    });
    throw new SafeExitError("Voice/TTS requires a valid render plan before audio generation.");
  }

  const voiceover = await readFile(artifactPath(run.runId, "production/voiceover.txt"), "utf8");
  const source = {
    path: "production/voiceover.txt" as const,
    sha256: createHash("sha256").update(voiceover, "utf8").digest("hex"),
    wordCount: countWords(voiceover),
  };
  if (source.wordCount === 0) {
    throw new SafeExitError("Voice/TTS requires non-empty production/voiceover.txt.");
  }

  const audio =
    config.providers.tts.mode === "deterministic-local"
      ? synthesizeDeterministicReferenceAudio(voiceover)
      : await synthesizePiperAudio({
          binary: config.providers.tts.piperBinary ?? "piper",
          configPath: config.providers.tts.piperConfigPath,
          modelPath: config.providers.tts.piperModelPath,
          runId: run.runId,
          text: voiceover,
        });

  if (config.providers.tts.mode === "deterministic-local") {
    run = await writeRunBinary(run, "voice", voiceoverAudioPath, audio.buffer);
  } else {
    run = await recordRunArtifact(run, "voice", voiceoverAudioPath);
  }

  const digest = createHash("sha256").update(audio.buffer).digest("hex");
  const meta = voiceoverAudioMetaSchema.parse({
    schemaVersion: 1,
    runId: run.runId,
    createdAt: nowIso(),
    mode: config.providers.tts.mode,
    quality: audio.quality,
    source,
    renderPlan: {
      path: "production/render_plan.json",
      digest: renderPlan.digest,
    },
    output: {
      path: voiceoverAudioPath,
      sha256: digest,
      bytes: audio.buffer.byteLength,
      durationSeconds: audio.durationSeconds,
      sampleRateHz: audio.sampleRateHz,
      channels: audio.channels,
    },
    provider: audio.provider,
  });
  run = await writeRunJson(run, "voice", voiceoverAudioMetaPath, meta);
  await saveRun(run);
  return meta;
}

function synthesizeDeterministicReferenceAudio(text: string): SynthesizedAudio {
  const sampleRateHz = 16_000;
  const wordCount = countWords(text);
  const durationSeconds = Math.max(1, Math.min(45, Math.ceil(wordCount / 2.4)));
  const sampleCount = sampleRateHz * durationSeconds;
  const pcm = Buffer.alloc(sampleCount * 2);
  const seed = createHash("sha256").update(text, "utf8").digest();
  const baseFrequency = 180 + seed[0];
  for (let index = 0; index < sampleCount; index += 1) {
    const t = index / sampleRateHz;
    const carrier = Math.sin(2 * Math.PI * baseFrequency * t);
    const pulse = Math.sin(2 * Math.PI * (baseFrequency / 3) * t) > 0 ? 1 : 0.25;
    pcm.writeInt16LE(Math.round(carrier * pulse * 2_800), index * 2);
  }
  return {
    buffer: wavFromPcm16(pcm, sampleRateHz, 1),
    channels: 1,
    durationSeconds,
    quality: "deterministic-local-reference",
    sampleRateHz,
  };
}

async function synthesizePiperAudio(options: {
  binary: string;
  configPath?: string;
  modelPath?: string;
  runId: string;
  text: string;
}): Promise<SynthesizedAudio> {
  if (!options.modelPath) {
    throw new SafeExitError("local-piper TTS requires providers.tts.piperModelPath.");
  }
  if (!(await pathExists(options.modelPath))) {
    throw new SafeExitError(`Piper model is missing: ${options.modelPath}.`);
  }
  if (options.configPath && !(await pathExists(options.configPath))) {
    throw new SafeExitError(`Piper model config is missing: ${options.configPath}.`);
  }

  const output = artifactPath(options.runId, voiceoverAudioPath);
  await ensureDir(path.dirname(output));
  await rm(output, { force: true }).catch(() => undefined);
  const args = ["--model", options.modelPath, "--output_file", output];
  if (options.configPath) {
    args.push("--config", options.configPath);
  }
  await runPiper(options.binary, args, options.text);
  const buffer = await readFile(output);
  const wav = readWavInfo(buffer);
  return {
    buffer,
    channels: wav.channels,
    durationSeconds: wav.durationSeconds,
    provider: {
      binary: options.binary,
      modelPath: options.modelPath,
      configPath: options.configPath,
    },
    quality: "local-piper",
    sampleRateHz: wav.sampleRateHz,
  };
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

function wavFromPcm16(pcm: Buffer, sampleRateHz: number, channels: number): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = sampleRateHz * channels * 2;
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRateHz, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(channels * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function readWavInfo(buffer: Buffer): {
  channels: number;
  durationSeconds: number;
  sampleRateHz: number;
} {
  if (
    buffer.subarray(0, 4).toString("ascii") !== "RIFF" ||
    buffer.subarray(8, 12).toString("ascii") !== "WAVE"
  ) {
    throw new SafeExitError("Piper output is not a WAV RIFF file.");
  }
  let channels = 0;
  let sampleRateHz = 0;
  let byteRate = 0;
  let dataBytes = 0;
  for (let offset = 12; offset + 8 <= buffer.length; ) {
    const chunkId = buffer.subarray(offset, offset + 4).toString("ascii");
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;
    if (chunkId === "fmt ") {
      channels = buffer.readUInt16LE(dataOffset + 2);
      sampleRateHz = buffer.readUInt32LE(dataOffset + 4);
      byteRate = buffer.readUInt32LE(dataOffset + 8);
    } else if (chunkId === "data") {
      dataBytes = chunkSize;
    }
    offset = dataOffset + chunkSize + (chunkSize % 2);
  }
  if (channels <= 0 || sampleRateHz <= 0 || byteRate <= 0 || dataBytes <= 0) {
    throw new SafeExitError("Piper output WAV metadata is incomplete.");
  }
  return { channels, durationSeconds: dataBytes / byteRate, sampleRateHz };
}

function countWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}
