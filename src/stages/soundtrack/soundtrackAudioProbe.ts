import { spawn } from "node:child_process";
import { z } from "zod";
import { SafeExitError } from "../../core/errors.js";

const probeOutputSchema = z.looseObject({
  format: z.looseObject({ duration: z.string().optional() }).optional(),
  streams: z
    .array(
      z.looseObject({
        channels: z.number().optional(),
        codec_name: z.string().optional(),
        codec_type: z.string().optional(),
        duration: z.string().optional(),
        sample_rate: z.string().optional(),
      }),
    )
    .default([]),
});

export const soundtrackAudioProbeSchema = z.strictObject({
  codec: z.enum(["pcm_s16le", "pcm_s24le", "mp3", "aac", "vorbis", "flac"]),
  channels: z.union([z.literal(1), z.literal(2)]),
  sampleRateHz: z.union([z.literal(44_100), z.literal(48_000)]),
  durationSeconds: z
    .number()
    .positive()
    .max(60 * 60),
});

export type SoundtrackAudioProbe = z.infer<typeof soundtrackAudioProbeSchema>;

const STDOUT_LIMIT_BYTES = 1_000_000;
const PROBE_TIMEOUT_MS = 30_000;

/** Probes one operator-imported audio file through the bounded FFprobe JSON surface. */
export async function probeSoundtrackAudio(
  binary: string,
  filePath: string,
): Promise<SoundtrackAudioProbe> {
  const stdout = await runFfprobe(binary, filePath);
  let parsed: z.infer<typeof probeOutputSchema>;
  try {
    parsed = probeOutputSchema.parse(JSON.parse(stdout));
  } catch (error) {
    throw new SafeExitError(
      `FFprobe returned invalid soundtrack JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const audio = parsed.streams.find((stream) => stream.codec_type === "audio");
  if (!audio)
    throw new SafeExitError("FFprobe did not find an audio stream in the soundtrack import.");
  const durationSeconds = positiveNumber(audio.duration) ?? positiveNumber(parsed.format?.duration);
  if (durationSeconds === undefined) {
    throw new SafeExitError("FFprobe did not report a positive soundtrack duration.");
  }
  try {
    return soundtrackAudioProbeSchema.parse({
      codec: audio.codec_name,
      channels: audio.channels,
      sampleRateHz: Number(audio.sample_rate),
      durationSeconds,
    });
  } catch (error) {
    throw new SafeExitError(
      `Soundtrack audio format is unsupported: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function runFfprobe(binary: string, filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      binary,
      ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", filePath],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      reject(new SafeExitError("FFprobe soundtrack probe timed out."));
    }, PROBE_TIMEOUT_MS);
    timer.unref?.();
    child.stdout.on("data", (chunk: Buffer) => {
      if (settled) return;
      const next = `${stdout}${chunk.toString("utf8")}`;
      if (Buffer.byteLength(next, "utf8") > STDOUT_LIMIT_BYTES) {
        settled = true;
        clearTimeout(timer);
        child.kill();
        reject(new SafeExitError("FFprobe soundtrack output exceeded the JSON size limit."));
        return;
      }
      stdout = next;
    });
    child.stderr.on("data", (chunk: Buffer) => {
      if (settled) return;
      stderr = `${stderr}${chunk.toString("utf8")}`.slice(-4_000);
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new SafeExitError(`FFprobe failed to start: ${error.message}`));
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(new SafeExitError(`FFprobe exited with code ${code}: ${stderr.trim()}`));
    });
  });
}

function positiveNumber(value: string | undefined): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
