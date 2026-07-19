import { chmod, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { probeSoundtrackAudio } from "../src/stages/soundtrack/soundtrackAudioProbe.js";
import { useTempProject } from "./helpers.js";

describe("soundtrack audio probe", () => {
  useTempProject();

  it("accepts bounded stereo production audio metadata", async () => {
    const ffprobe = await fakeProbe({
      format: { duration: "12.5" },
      streams: [{ codec_type: "audio", codec_name: "flac", sample_rate: "48000", channels: 2 }],
    });
    await expect(probeSoundtrackAudio(ffprobe, "music.flac")).resolves.toEqual({
      codec: "flac",
      channels: 2,
      sampleRateHz: 48_000,
      durationSeconds: 12.5,
    });
  });

  it("rejects unsupported sample rates and missing audio streams", async () => {
    const unsupported = await fakeProbe({
      format: { duration: "1" },
      streams: [{ codec_type: "audio", codec_name: "aac", sample_rate: "22050", channels: 2 }],
    });
    await expect(probeSoundtrackAudio(unsupported, "music.m4a")).rejects.toThrow(/unsupported/i);

    const missing = await fakeProbe({ format: { duration: "1" }, streams: [] });
    await expect(probeSoundtrackAudio(missing, "music.m4a")).rejects.toThrow(/audio stream/i);
  });
});

async function fakeProbe(output: unknown): Promise<string> {
  const target = path.join(process.cwd(), `.tmp-soundtrack-probe-${Math.random()}.mjs`);
  await writeFile(
    target,
    `#!/usr/bin/env node\nconsole.log(${JSON.stringify(JSON.stringify(output))});\n`,
    "utf8",
  );
  await chmod(target, 0o755);
  return target;
}
