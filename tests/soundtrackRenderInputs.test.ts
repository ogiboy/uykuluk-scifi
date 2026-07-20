import { describe, expect, it } from "vitest";
import { soundtrackRenderInputs } from "../src/stages/render/soundtrackRenderInputs.js";
import type { SoundtrackManifest } from "../src/stages/soundtrack/soundtrackManifest.js";

describe("soundtrack render inputs", () => {
  it("maps selected music and SFX assets without changing their reviewed settings", () => {
    const manifest = fixture();
    expect(soundtrackRenderInputs(manifest)).toEqual({
      voiceoverPath: "production/audio/voiceover.wav",
      music: {
        path: "production/audio/soundtrack/assets/music.wav",
        gainDb: -18,
        trimStartSeconds: 2,
        fadeInSeconds: 1,
        fadeOutSeconds: 2,
      },
      sfx: [
        {
          path: "production/audio/soundtrack/assets/chime.wav",
          gainDb: -9,
          startSeconds: 3,
          trimStartSeconds: 0,
          durationSeconds: 1,
          fadeInSeconds: 0.05,
          fadeOutSeconds: 0.1,
        },
      ],
    });
  });

  it("maps the current configured mix before loudness review", () => {
    const manifest = { ...fixture(), analysis: undefined, decision: undefined };
    expect(soundtrackRenderInputs(manifest).voiceoverPath).toBe("production/audio/voiceover.wav");
  });
});

function fixture(): SoundtrackManifest {
  const measured = {
    integratedLufs: -18,
    truePeakDbtp: -3,
    loudnessRangeLufs: 5,
    thresholdLufs: -28,
    targetOffsetLufs: 4,
  };
  return {
    schemaVersion: 1,
    runId: "run_soundtrack_mapping",
    revision: 2,
    createdAt: "2026-07-20T00:00:00.000Z",
    updatedAt: "2026-07-20T00:01:00.000Z",
    voiceover: {
      path: "production/audio/voiceover.wav",
      digest: "a".repeat(64),
      metadataDigest: "b".repeat(64),
      durationSeconds: 10,
    },
    mode: "mixed",
    profile: {
      targetLufs: -14,
      lufsTolerance: 1,
      maxTruePeakDbtp: -1,
      normalizationCeilingDb: -1.5,
      loudnessRange: 11,
    },
    assets: [asset("music", "music", 30), asset("chime", "sfx", 2)],
    music: {
      assetId: "music",
      gainDb: -18,
      trimStartSeconds: 2,
      fadeInSeconds: 1,
      fadeOutSeconds: 2,
    },
    sfx: [
      {
        cueId: "chime-1",
        assetId: "chime",
        startSeconds: 3,
        gainDb: -9,
        trimStartSeconds: 0,
        durationSeconds: 1,
        fadeInSeconds: 0.05,
        fadeOutSeconds: 0.1,
      },
    ],
    analysis: {
      algorithm: "ffmpeg-loudnorm-two-pass-v1",
      measuredAt: "2026-07-20T00:00:30.000Z",
      normalizationMode: "linear",
      firstPass: measured,
    },
    decision: {
      revision: 2,
      status: "approved",
      reviewedBy: "Operator",
      notes: "Balanced against narration.",
      decidedAt: "2026-07-20T00:01:00.000Z",
    },
  };
}

function asset(assetId: string, role: "music" | "sfx", durationSeconds: number) {
  return {
    assetId,
    role,
    path: `production/audio/soundtrack/assets/${assetId}.wav`,
    digest: "c".repeat(64),
    media: {
      bytes: 100,
      container: "wav" as const,
      codec: "pcm_s16le" as const,
      channels: 2 as const,
      sampleRateHz: 48_000 as const,
      durationSeconds,
    },
    provenance: {
      importedBy: "Operator",
      importedAt: "2026-07-20T00:00:00.000Z",
      originalFileName: `${assetId}.wav`,
      rights: {
        basis: "licensed" as const,
        attestedBy: "Operator",
        attestedAt: "2026-07-20T00:00:00.000Z",
        evidence: "License receipt retained by the operator.",
      },
    },
  };
}
