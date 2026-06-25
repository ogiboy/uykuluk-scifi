import { spawn } from "node:child_process";
import { z } from "zod";
import { SafeExitError } from "../core/errors.js";

const ffprobeStreamSchema = z.looseObject({
  channels: z.number().optional(),
  codec_name: z.string().optional(),
  codec_type: z.string().optional(),
  duration: z.string().optional(),
  height: z.number().optional(),
  sample_rate: z.string().optional(),
  width: z.number().optional(),
});

const ffprobeOutputSchema = z.looseObject({
  format: z
    .looseObject({
      duration: z.string().optional(),
      format_name: z.string().optional(),
    })
    .optional(),
  streams: z.array(ffprobeStreamSchema).default([]),
});

export const renderMediaProbeSchema = z.strictObject({
  binary: z.string().min(1),
  durationSeconds: z.number().positive(),
  formatName: z.string().min(1).optional(),
  video: z.strictObject({
    codecName: z.string().min(1).optional(),
    width: z.int().positive(),
    height: z.int().positive(),
  }),
  audio: z.strictObject({
    channels: z.int().positive().optional(),
    codecName: z.string().min(1).optional(),
    sampleRateHz: z.int().positive().optional(),
  }),
});

export type RenderMediaProbe = z.infer<typeof renderMediaProbeSchema>;

type FfprobeStream = z.infer<typeof ffprobeStreamSchema>;
type FfprobeOutput = z.infer<typeof ffprobeOutputSchema>;

export async function probeDraftRender(
  binary: string,
  outputPath: string,
): Promise<RenderMediaProbe> {
  const stdout = await runFfprobe(binary, outputPath);
  const parsed = parseFfprobeOutput(stdout);
  const video = requiredStream(parsed.streams, "video");
  const audio = requiredStream(parsed.streams, "audio");
  const durationSeconds = parseDuration(parsed, video, audio);
  const width = positiveInteger(video.width);
  const height = positiveInteger(video.height);
  if (width === undefined || height === undefined) {
    throw new SafeExitError("FFprobe did not report a valid video resolution.");
  }
  return renderMediaProbeSchema.parse({
    audio: {
      channels: positiveInteger(audio.channels),
      codecName: audio.codec_name,
      sampleRateHz: positiveInteger(Number(audio.sample_rate)),
    },
    binary,
    durationSeconds,
    formatName: parsed.format?.format_name,
    video: {
      codecName: video.codec_name,
      height,
      width,
    },
  });
}

function parseFfprobeOutput(stdout: string): FfprobeOutput {
  try {
    return ffprobeOutputSchema.parse(JSON.parse(stdout));
  } catch (error) {
    throw new SafeExitError(
      `FFprobe returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function parseDuration(parsed: FfprobeOutput, video: FfprobeStream, audio: FfprobeStream): number {
  const duration =
    positiveNumber(parsed.format?.duration) ??
    positiveNumber(video.duration) ??
    positiveNumber(audio.duration);
  if (duration === undefined) {
    throw new SafeExitError("FFprobe did not report a positive draft render duration.");
  }
  return duration;
}

function requiredStream(streams: FfprobeStream[], type: "audio" | "video"): FfprobeStream {
  const stream = streams.find((item) => item.codec_type === type);
  if (!stream) {
    throw new SafeExitError(`FFprobe did not find a ${type} stream in the draft render.`);
  }
  return stream;
}

function positiveInteger(value: number | undefined): number | undefined {
  return value !== undefined && Number.isInteger(value) && value > 0 ? value : undefined;
}

function positiveNumber(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

async function runFfprobe(binary: string, outputPath: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(
      binary,
      ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", outputPath],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout = `${stdout}${chunk.toString("utf8")}`.slice(-20_000);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = `${stderr}${chunk.toString("utf8")}`.slice(-4_000);
    });
    child.on("error", (error) =>
      reject(new SafeExitError(`FFprobe failed to start: ${error.message}`)),
    );
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(new SafeExitError(`FFprobe exited with code ${code}: ${stderr.trim()}`));
    });
  });
}
