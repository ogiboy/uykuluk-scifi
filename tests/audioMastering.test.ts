import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import {
  assertMasteringOutput,
  firstPassLoudnormFilter,
  parseLoudnormMeasurement,
  secondPassLoudnormFilter,
} from "../src/stages/render/audioMastering.js";
import {
  buildRenderedOutputAnalysisArgs,
  buildSoundtrackAnalysisArgs,
  runLoudnormAnalysis,
} from "../src/stages/render/audioMasteringExecution.js";

const validMeasurement = {
  integratedLufs: -14.2,
  truePeakDbtp: -1.3,
  loudnessRangeLufs: 6.1,
  thresholdLufs: -24.4,
  targetOffsetLufs: 0.2,
};
const executionRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    executionRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("audio mastering", () => {
  it("builds deterministic first- and measured second-pass loudnorm filters", () => {
    expect(firstPassLoudnormFilter()).toBe("loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json");
    expect(secondPassLoudnormFilter(validMeasurement)).toContain(
      "measured_I=-14.2:measured_TP=-1.3:measured_LRA=6.1:measured_thresh=-24.4:offset=0.2:linear=true",
    );
  });

  it("parses the final complete loudnorm object from noisy FFmpeg stderr", () => {
    const earlierMeasurement = {
      input_i: "-18.0",
      input_tp: "-2.0",
      input_lra: "8.0",
      input_thresh: "-28.0",
      target_offset: "0.0",
    };
    const finalMeasurement = {
      input_i: "-14.2",
      input_tp: "-1.3",
      input_lra: "6.1",
      input_thresh: "-24.4",
      target_offset: "0.2",
    };
    const stderr = `frame=1\n${JSON.stringify(earlierMeasurement)}\nnoise\n${JSON.stringify(finalMeasurement)}\n`;

    expect(parseLoudnormMeasurement(stderr)).toEqual(validMeasurement);
  });

  it("rejects incomplete or non-finite loudnorm output", () => {
    expect(() => parseLoudnormMeasurement('{"input_i":"-14","input_tp":"inf"}')).toThrow(
      /complete loudnorm/i,
    );
  });

  it("accepts output inside the publish-quality envelope", () => {
    expect(() => assertMasteringOutput(validMeasurement)).not.toThrow();
  });

  it.each([
    [{ ...validMeasurement, integratedLufs: -15.1 }, /integrated loudness/i],
    [{ ...validMeasurement, truePeakDbtp: -0.9 }, /true peak/i],
    [{ ...validMeasurement, loudnessRangeLufs: 11.1 }, /loudness range/i],
  ])("rejects output outside the mastering envelope", (measurement, expected) => {
    expect(() => assertMasteringOutput(measurement)).toThrow(expected);
  });
});

describe("audio mastering execution", () => {
  it("builds analysis arguments from the canonical soundtrack graph", () => {
    expect(
      buildSoundtrackAnalysisArgs({
        filter: "[0:a]loudnorm=print_format=json[a]",
        inputArgs: ["-i", "/tmp/voice.wav"],
        inputCount: 1,
      }),
    ).toEqual([
      "-hide_banner",
      "-nostdin",
      "-i",
      "/tmp/voice.wav",
      "-filter_complex",
      "[0:a]loudnorm=print_format=json[a]",
      "-map",
      "[a]",
      "-f",
      "null",
      "-",
    ]);
    expect(buildRenderedOutputAnalysisArgs("/tmp/draft.mp4")).toEqual(
      expect.arrayContaining(["-i", "/tmp/draft.mp4", "-map", "0:a:0"]),
    );
  });

  it("returns parsed loudnorm measurements from bounded stderr", async () => {
    const binary = await fakeLoudnormBinary(
      "console.error(JSON.stringify({input_i:'-14.1',input_tp:'-1.3',input_lra:'5.2',input_thresh:'-24.0',target_offset:'0.1'}));",
    );
    await expect(runLoudnormAnalysis(binary, [], 1_000)).resolves.toMatchObject({
      measurement: {
        integratedLufs: -14.1,
        truePeakDbtp: -1.3,
        loudnessRangeLufs: 5.2,
        thresholdLufs: -24,
        targetOffsetLufs: 0.1,
      },
    });
  });

  it("fails closed when FFmpeg does not complete before the deadline", async () => {
    const binary = await fakeLoudnormBinary("setTimeout(() => {}, 10_000);");
    await expect(runLoudnormAnalysis(binary, [], 10)).rejects.toThrow(/timed out/i);
  });
});

async function fakeLoudnormBinary(body: string): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "uykuluk-mastering-execution-"));
  executionRoots.push(root);
  const target = path.join(root, "ffmpeg.mjs");
  await writeFile(target, `#!/usr/bin/env node\n${body}\n`, "utf8");
  await chmod(target, 0o755);
  return target;
}
