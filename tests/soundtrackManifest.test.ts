import { describe, expect, it } from "vitest";

import {
  assertSoundtrackDecisionTargetsCurrentRevision,
  soundtrackAssetDigest,
  soundtrackAssetPath,
  soundtrackManifestSchema,
  soundtrackMasteringProfile,
  validateSoundtrackManifest,
  validateSoundtrackManifestForRun,
} from "../src/stages/soundtrack/soundtrackManifest.js";

const musicBytes = new Uint8Array([1, 2, 3]);
const sfxBytes = new Uint8Array([4, 5, 6]);

function manifest() {
  return {
    schemaVersion: 1,
    runId: "run_soundtrack",
    revision: 2,
    createdAt: "2026-07-20T10:00:00.000Z",
    updatedAt: "2026-07-20T10:00:00.000Z",
    voiceover: {
      path: "production/audio/voiceover.wav",
      digest: soundtrackAssetDigest(new Uint8Array([7, 8, 9])),
      metadataDigest: soundtrackAssetDigest(new Uint8Array([10, 11, 12])),
      durationSeconds: 42,
    },
    mode: "mixed",
    profile: soundtrackMasteringProfile,
    assets: [
      {
        assetId: "bed",
        role: "music",
        path: soundtrackAssetPath("bed", "wav"),
        digest: soundtrackAssetDigest(musicBytes),
        media: {
          bytes: 3,
          container: "wav",
          codec: "pcm_s24le",
          channels: 2,
          sampleRateHz: 48_000,
          durationSeconds: 10,
        },
        provenance: {
          importedBy: "operator",
          importedAt: "2026-07-20T10:00:00.000Z",
          originalFileName: "bed.wav",
          rights: {
            basis: "licensed",
            attestedBy: "operator",
            attestedAt: "2026-07-20T10:00:00.000Z",
            evidence: "License receipt retained locally",
          },
        },
      },
      {
        assetId: "hit",
        role: "sfx",
        path: soundtrackAssetPath("hit", "wav"),
        digest: soundtrackAssetDigest(sfxBytes),
        media: {
          bytes: 3,
          container: "wav",
          codec: "pcm_s24le",
          channels: 1,
          sampleRateHz: 48_000,
          durationSeconds: 1,
        },
        provenance: {
          importedBy: "operator",
          importedAt: "2026-07-20T10:00:00.000Z",
          originalFileName: "hit.wav",
          rights: {
            basis: "owned",
            attestedBy: "operator",
            attestedAt: "2026-07-20T10:00:00.000Z",
            evidence: "Original recording",
          },
        },
      },
    ],
    music: {
      assetId: "bed",
      gainDb: -18,
      trimStartSeconds: 0,
      fadeInSeconds: 1,
      fadeOutSeconds: 1,
    },
    sfx: [
      {
        cueId: "opening-hit",
        assetId: "hit",
        startSeconds: 3,
        gainDb: -6,
        trimStartSeconds: 0,
        durationSeconds: 1,
        fadeInSeconds: 0.1,
        fadeOutSeconds: 0.1,
      },
    ],
    analysis: {
      algorithm: "ffmpeg-loudnorm-two-pass-v1" as const,
      measuredAt: "2026-07-20T10:00:00.000Z",
      normalizationMode: "linear" as const,
      firstPass: {
        integratedLufs: -18,
        truePeakDbtp: -3,
        loudnessRangeLufs: 6,
        thresholdLufs: -28,
        targetOffsetLufs: 0.1,
      },
    },
    decision: {
      revision: 2,
      status: "approved",
      reviewedBy: "operator",
      notes: "voice remains foreground",
      decidedAt: "2026-07-20T10:00:00.000Z",
    },
  };
}

describe("soundtrack manifest", () => {
  it("accepts canonical imported assets, voice-forward mastering, and exact decisions", async () => {
    const value = manifest();
    await expect(
      validateSoundtrackManifest(value, {
        runId: "run_soundtrack",
        readBytes: (path) => (path.endsWith("bed.wav") ? musicBytes : sfxBytes),
      }),
    ).resolves.toMatchObject({ mode: "mixed", revision: 2 });
  });

  it("rejects arbitrary asset paths and invalid selections", () => {
    const wrongPath = manifest();
    wrongPath.assets[0].path = "outside/filter.wav";
    expect(() => soundtrackManifestSchema.parse(wrongPath)).toThrow("Asset path must be");

    const wrongSelection = manifest();
    wrongSelection.music!.assetId = "hit";
    expect(() => soundtrackManifestSchema.parse(wrongSelection)).toThrow(
      "Music selection must reference",
    );
  });

  it("bounds trims and fades against their selected asset duration", () => {
    const lateMusicTrim = manifest();
    lateMusicTrim.music!.trimStartSeconds = 10;
    expect(() => soundtrackManifestSchema.parse(lateMusicTrim)).toThrow("Music trim must start");

    const oversizedCue = manifest();
    oversizedCue.sfx[0].durationSeconds = 2;
    expect(() => soundtrackManifestSchema.parse(oversizedCue)).toThrow("must fit within");

    const oversizedFade = manifest();
    oversizedFade.sfx[0].fadeOutSeconds = 2;
    expect(() => soundtrackManifestSchema.parse(oversizedFade)).toThrow("fades cannot exceed");
  });

  it("rejects voice-only selections, stale decisions, and overlong SFX lists", () => {
    const voiceOnly = manifest();
    voiceOnly.mode = "voice-only";
    expect(() => soundtrackManifestSchema.parse(voiceOnly)).toThrow("Voice-only mode");

    const stale = manifest();
    stale.decision!.revision = 1;
    expect(() => soundtrackManifestSchema.parse(stale)).toThrow("current revision");
    expect(() =>
      assertSoundtrackDecisionTargetsCurrentRevision({
        revision: 2,
        decision: { ...stale.decision!, status: "approved" },
      }),
    ).toThrow("current revision");

    const tooMany = manifest();
    tooMany.sfx = Array.from({ length: 33 }, (_, index) => ({
      cueId: `cue-${index}`,
      assetId: "hit",
      startSeconds: index,
      gainDb: -6,
      trimStartSeconds: 0,
      durationSeconds: 1,
      fadeInSeconds: 0,
      fadeOutSeconds: 0,
    }));
    expect(() => soundtrackManifestSchema.parse(tooMany)).toThrow();
  });

  it("requires current pass-one analysis before approving a soundtrack revision", () => {
    const { analysis: _analysis, ...value } = manifest();
    expect(() => soundtrackManifestSchema.parse(value)).toThrow(
      /require current loudness analysis/i,
    );
  });

  it("detects run mismatch and imported audio tampering through the injected reader", async () => {
    const value = manifest();
    expect(() => validateSoundtrackManifestForRun(value, "other_run")).toThrow(
      "does not match expected run",
    );
    await expect(
      validateSoundtrackManifest(value, {
        runId: "run_soundtrack",
        readBytes: () => new Uint8Array([9, 9, 9]),
      }),
    ).rejects.toThrow("digest does not match");
  });
});
