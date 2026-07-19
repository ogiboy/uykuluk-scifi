import { spawn } from "node:child_process";

import { SafeExitError } from "../../core/errors.js";
import {
  firstPassLoudnormFilter,
  parseLoudnormMeasurement,
  type LoudnormMeasurement,
} from "./audioMastering.js";
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
  return new Promise<LoudnormExecutionResult>((resolve, reject) => {
    const child = spawn(binary, [...args], { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(() => reject(new SafeExitError("FFmpeg loudness analysis timed out.")));
    }, timeoutMs);
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = `${stderr}${chunk.toString("utf8")}`.slice(-maximumDiagnosticBytes);
    });
    child.on("error", (error) => {
      finish(() =>
        reject(new SafeExitError(`FFmpeg loudness analysis failed to start: ${error.message}`)),
      );
    });
    child.on("close", (code) => {
      finish(() => {
        if (code !== 0) {
          reject(
            new SafeExitError(
              `FFmpeg loudness analysis exited with code ${code}: ${stderr.trim()}`,
            ),
          );
          return;
        }
        try {
          resolve({ measurement: parseLoudnormMeasurement(stderr), stderr });
        } catch (error) {
          reject(error);
        }
      });
    });
  });
}
