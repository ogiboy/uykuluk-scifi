import { chmod, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { probeDraftRender } from "../src/stages/renderProbe";
import { useTempProject } from "./helpers";

let fakeFfprobeIndex = 0;

describe("render media probe", () => {
  useTempProject();

  it("accepts stream duration when container duration is absent", async () => {
    const ffprobe = await createJsonFfprobe({
      format: { format_name: "mp4" },
      streams: [
        { codec_type: "video", codec_name: "h264", width: 1280, height: 720, duration: "4.5" },
        { codec_type: "audio", codec_name: "aac", sample_rate: "48000", channels: 2 },
      ],
    });

    await expect(probeDraftRender(ffprobe, "draft.mp4")).resolves.toMatchObject({
      durationSeconds: 4.5,
      formatName: "mp4",
      video: { width: 1280, height: 720 },
      audio: { sampleRateHz: 48000, channels: 2 },
    });
  });

  it("fails closed when ffprobe returns invalid JSON", async () => {
    const ffprobe = await createTextFfprobe("{");

    await expect(probeDraftRender(ffprobe, "draft.mp4")).rejects.toThrow(/invalid JSON/i);
  });

  it("fails closed when ffprobe omits required streams", async () => {
    const ffprobe = await createJsonFfprobe({
      format: { duration: "4.5" },
      streams: [{ codec_type: "video", width: 1280, height: 720 }],
    });

    await expect(probeDraftRender(ffprobe, "draft.mp4")).rejects.toThrow(/audio stream/i);
  });

  it("fails closed when ffprobe omits positive duration", async () => {
    const ffprobe = await createJsonFfprobe({
      streams: [
        { codec_type: "video", width: 1280, height: 720 },
        { codec_type: "audio", channels: 2 },
      ],
    });

    await expect(probeDraftRender(ffprobe, "draft.mp4")).rejects.toThrow(/positive.*duration/i);
  });

  it("fails closed when ffprobe omits valid video resolution", async () => {
    const ffprobe = await createJsonFfprobe({
      format: { duration: "4.5" },
      streams: [
        { codec_type: "video", width: 0, height: 720 },
        { codec_type: "audio", channels: 2 },
      ],
    });

    await expect(probeDraftRender(ffprobe, "draft.mp4")).rejects.toThrow(/video resolution/i);
  });

  it("fails closed when ffprobe cannot be started", async () => {
    await expect(probeDraftRender("./missing-ffprobe", "draft.mp4")).rejects.toThrow(
      /failed to start/i,
    );
  });
});

async function createJsonFfprobe(payload: unknown): Promise<string> {
  return createTextFfprobe(JSON.stringify(payload));
}

async function createTextFfprobe(stdout: string): Promise<string> {
  fakeFfprobeIndex += 1;
  const target = path.join(process.cwd(), `fake-ffprobe-${fakeFfprobeIndex}.mjs`);
  await writeFile(
    target,
    ["#!/usr/bin/env node", `process.stdout.write(${JSON.stringify(stdout)});`].join("\n"),
    "utf8",
  );
  await chmod(target, 0o755);
  return target;
}
