import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import {
  buildRenderedOutputAnalysisArgs,
  buildSoundtrackAnalysisArgs,
  runLoudnormAnalysis,
} from "../src/stages/render/audioMasteringExecution.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
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
    const binary = await fakeBinary(
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
    const binary = await fakeBinary("setTimeout(() => {}, 10_000);");
    await expect(runLoudnormAnalysis(binary, [], 10)).rejects.toThrow(/timed out/i);
  });
});

async function fakeBinary(body: string): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "uykuluk-mastering-execution-"));
  roots.push(root);
  const target = path.join(root, "ffmpeg.mjs");
  await writeFile(target, `#!/usr/bin/env node\n${body}\n`, "utf8");
  await chmod(target, 0o755);
  return target;
}
