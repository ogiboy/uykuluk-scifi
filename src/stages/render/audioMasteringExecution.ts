import { SafeExitError } from "../../core/errors.js";
import {
  firstPassLoudnormFilter,
  parseLoudnormMeasurement,
  type LoudnormMeasurement,
} from "./audioMastering.js";
import { runBoundedProcess } from "./boundedProcess.js";
import type { RenderAudioGraph } from "./renderAudioMix.js";

const maximumDiagnosticBytes = 128 * 1024;

export type LoudnormExecutionResult = Readonly<{
  measurement: LoudnormMeasurement;
  stderr: string;
}>;

/** Builds a bounded FFmpeg analysis command for the canonical unmastered soundtrack graph. */
export function buildSoundtrackAnalysisArgs(graph: RenderAudioGraph): string[] {
  return [
    "-hide_banner",
    "-nostdin",
    ...graph.inputArgs,
    "-filter_complex",
    graph.filter,
    "-map",
    "[a]",
    "-f",
    "null",
    "-",
  ];
}

/** Builds a post-encode loudness measurement command for the rendered AAC output. */
export function buildRenderedOutputAnalysisArgs(outputPath: string): string[] {
  return [
    "-hide_banner",
    "-nostdin",
    "-i",
    outputPath,
    "-map",
    "0:a:0",
    "-af",
    firstPassLoudnormFilter(),
    "-f",
    "null",
    "-",
  ];
}

/** Executes one FFmpeg loudnorm measurement with a timeout and bounded diagnostics. */
export async function runLoudnormAnalysis(
  binary: string,
  args: readonly string[],
  timeoutMs: number,
): Promise<LoudnormExecutionResult> {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new SafeExitError("FFmpeg loudness analysis requires a positive timeout.");
  }
  const stderr = await runBoundedProcess({
    command: binary,
    args,
    timeoutMs,
    killSignal: "SIGKILL",
    maxOutputBytes: maximumDiagnosticBytes,
    errorContext: "FFmpeg loudness analysis",
  });
  try {
    return { measurement: parseLoudnormMeasurement(stderr), stderr };
  } catch (error) {
    throw error;
  }
}
