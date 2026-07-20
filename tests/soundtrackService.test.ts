import { chmod, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { artifactPath } from "../src/core/artifacts.js";
import { readLedger } from "../src/core/ledger.js";
import { loadRun } from "../src/core/runStore.js";
import { probeSoundtrackAudio } from "../src/stages/soundtrack/soundtrackAudioProbe.js";
import {
  analyzeSoundtrackLoudness,
  configureSoundtrackMix,
  decideSoundtrack,
  importSoundtrackAudio,
  prepareVoiceOnlySoundtrack,
  requireApprovedSoundtrackManifest,
} from "../src/stages/soundtrack/soundtrackService.js";
import { generateVoiceoverAudio } from "../src/stages/voice.js";
import { useTempProject } from "./helpers.js";
import { enableDeterministicTts, prepareReadyRun } from "./voiceTestFixtures.js";

describe("soundtrack service", () => {
  useTempProject();

  it("binds local import, loudnorm analysis, and approval to exact soundtrack revisions", async () => {
    await enableDeterministicTts();
    const runId = await prepareReadyRun({ renderPlan: true });
    await generateVoiceoverAudio(runId);

    const prepared = await prepareVoiceOnlySoundtrack({ runId });
    expect(prepared.manifest).toMatchObject({ mode: "voice-only", revision: 1, assets: [] });

    const sourcePath = path.join(process.cwd(), "music.wav");
    const source = Buffer.from([1, 2, 3, 4]);
    await writeFile(sourcePath, source);
    const imported = await importSoundtrackAudio({
      runId,
      expectedManifestDigest: prepared.digest,
      expectedRevision: prepared.manifest.revision,
      assetId: "bed",
      role: "music",
      sourcePath,
      provenance: {
        importedBy: "operator",
        importedAt: "2026-07-20T10:00:00.000Z",
        originalFileName: "music.wav",
        rights: {
          basis: "licensed",
          attestedBy: "operator",
          attestedAt: "2026-07-20T10:00:00.000Z",
          evidence: "license retained locally",
        },
      },
      probe: async () => ({
        codec: "pcm_s24le",
        channels: 2,
        sampleRateHz: 48_000,
        durationSeconds: 30,
      }),
    });
    await expect(
      readFile(artifactPath(runId, "production/audio/soundtrack/assets/bed.wav")),
    ).resolves.toEqual(source);

    const mixed = await configureSoundtrackMix({
      runId,
      expectedManifestDigest: imported.digest,
      expectedRevision: imported.manifest.revision,
      music: {
        assetId: "bed",
        gainDb: -18,
        trimStartSeconds: 0,
        fadeInSeconds: 1,
        fadeOutSeconds: 1,
      },
      sfx: [],
    });
    await writeFile(
      artifactPath(runId, "production/audio/soundtrack/assets/bed.wav"),
      Buffer.from([9, 9, 9, 9]),
    );
    await expect(
      analyzeSoundtrackLoudness({
        runId,
        expectedManifestDigest: mixed.digest,
        expectedRevision: mixed.manifest.revision,
        ffmpeg: async () => ({ stderr: "" }),
      }),
    ).rejects.toThrow(/digest does not match/i);
    await writeFile(artifactPath(runId, "production/audio/soundtrack/assets/bed.wav"), source);
    const analyzed = await analyzeSoundtrackLoudness({
      runId,
      expectedManifestDigest: mixed.digest,
      expectedRevision: mixed.manifest.revision,
      ffmpeg: async (input) => {
        expect(input).toMatchObject({ timeoutMs: 30 * 60_000, maxStderrBytes: 128_000 });
        expect(input.args.join(" ")).toContain("loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json");
        return {
          stderr:
            '{"input_i":"-14","input_tp":"-1.5","input_lra":"5","input_thresh":"-24","target_offset":"0"}',
        };
      },
    });
    await writeFile(
      artifactPath(runId, "production/audio/soundtrack/assets/bed.wav"),
      Buffer.from([9, 9, 9, 9]),
    );
    await expect(
      decideSoundtrack({
        runId,
        expectedManifestDigest: analyzed.digest,
        expectedRevision: analyzed.manifest.revision,
        status: "approved",
        reviewedBy: "operator",
        notes: "Voice remains intelligible.",
      }),
    ).rejects.toThrow(/digest does not match/i);
    await writeFile(artifactPath(runId, "production/audio/soundtrack/assets/bed.wav"), source);
    const approved = await decideSoundtrack({
      runId,
      expectedManifestDigest: analyzed.digest,
      expectedRevision: analyzed.manifest.revision,
      status: "approved",
      reviewedBy: "operator",
      notes: "Voice remains intelligible.",
    });
    await expect(requireApprovedSoundtrackManifest(await loadRun(runId))).resolves.toMatchObject({
      digest: approved.digest,
    });
    expect(await readLedger(runId)).toContainEqual(
      expect.objectContaining({ type: "REVIEW_DECISION_RECORDED", stage: "soundtrack" }),
    );
  });

  it("fails closed if a registered soundtrack asset is tampered after approval", async () => {
    await enableDeterministicTts();
    const runId = await prepareReadyRun({ renderPlan: true });
    await generateVoiceoverAudio(runId);
    const prepared = await prepareVoiceOnlySoundtrack({ runId });
    const sourcePath = path.join(process.cwd(), "tamper.wav");
    await writeFile(sourcePath, Buffer.from([1, 2, 3]));
    const imported = await importSoundtrackAudio({
      runId,
      expectedManifestDigest: prepared.digest,
      expectedRevision: 1,
      assetId: "bed",
      role: "music",
      sourcePath,
      provenance: {
        importedBy: "operator",
        importedAt: "2026-07-20T10:00:00.000Z",
        originalFileName: "tamper.wav",
        rights: {
          basis: "owned",
          attestedBy: "operator",
          attestedAt: "2026-07-20T10:00:00.000Z",
          evidence: "original",
        },
      },
      probe: async () => ({
        codec: "pcm_s16le",
        channels: 1,
        sampleRateHz: 48_000,
        durationSeconds: 1,
      }),
    });
    const analyzed = await analyzeSoundtrackLoudness({
      runId,
      expectedManifestDigest: imported.digest,
      expectedRevision: 2,
      ffmpeg: async () => ({
        stderr:
          '{"input_i":"-14","input_tp":"-1.5","input_lra":"5","input_thresh":"-24","target_offset":"0"}',
      }),
    });
    await decideSoundtrack({
      runId,
      expectedManifestDigest: analyzed.digest,
      expectedRevision: 2,
      status: "approved",
      reviewedBy: "operator",
      notes: "Approved.",
    });
    await writeFile(
      artifactPath(runId, "production/audio/soundtrack/assets/bed.wav"),
      Buffer.from([9, 9, 9]),
    );
    await expect(requireApprovedSoundtrackManifest(await loadRun(runId))).rejects.toThrow(
      /digest does not match/i,
    );
  });
});

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
