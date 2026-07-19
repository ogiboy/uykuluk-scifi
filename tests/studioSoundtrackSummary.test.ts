import { describe, expect, it } from "vitest";
import { soundtrackSummaryFromManifest } from "../apps/studio/src/lib/runs/soundtrackSummaries";
import type { SoundtrackManifest } from "../src/stages/soundtrack/soundtrackManifest";

const digest = "a".repeat(64);
const voiceDigest = "b".repeat(64);

describe("Studio soundtrack summary", () => {
  it("projects rights, current mix, analysis, and an exact revision-bound decision", () => {
    const summary = soundtrackSummaryFromManifest(manifest({ decision: "approved" }), digest);

    expect(summary).toMatchObject({
      analysis: { status: "complete" },
      decision: { reviewedBy: "audio reviewer", status: "approved" },
      digest,
      kind: "ready",
      mix: { music: { assetId: "bed", gainDb: -18 }, sfxCueCount: 0 },
      nextAction: "Soundtrack approval is current for this exact revision.",
      revision: 3,
    });
    expect(summary.assets).toEqual([
      expect.objectContaining({
        assetId: "bed",
        rights: expect.objectContaining({ basis: "licensed", evidence: "license-42" }),
        role: "music",
      }),
    ]);
  });

  it("keeps a voice-only revision reviewable and directs the operator to analysis", () => {
    const summary = soundtrackSummaryFromManifest(
      manifest({ analysis: false, decision: null, music: false }),
      digest,
    );

    expect(summary).toMatchObject({
      analysis: null,
      decision: null,
      mix: { music: null, sfxCueCount: 0 },
      mode: "voice-only",
      nextAction: "Run pass-1 loudness analysis for this exact revision.",
    });
  });
});

function manifest(
  input: Readonly<{ analysis?: boolean; decision: "approved" | null; music?: boolean }>,
): SoundtrackManifest {
  const now = "2026-07-20T12:00:00.000Z";
  const asset = {
    assetId: "bed",
    digest,
    media: {
      bytes: 20,
      channels: 2 as const,
      codec: "flac" as const,
      container: "flac" as const,
      durationSeconds: 60,
      sampleRateHz: 48_000 as const,
    },
    path: "production/audio/soundtrack/assets/bed.flac",
    provenance: {
      importedAt: now,
      importedBy: "audio editor",
      originalFileName: "bed.flac",
      rights: {
        attestedAt: now,
        attestedBy: "rights reviewer",
        basis: "licensed" as const,
        evidence: "license-42",
      },
    },
    role: "music" as const,
  };
  return {
    assets: input.music === false ? [] : [asset],
    createdAt: now,
    decision: input.decision
      ? {
          decidedAt: now,
          notes: "Ready for render review.",
          reviewedBy: "audio reviewer",
          revision: 3,
          status: input.decision,
        }
      : undefined,
    mode: input.music === false ? "voice-only" : "mixed",
    music:
      input.music === false
        ? undefined
        : { assetId: "bed", fadeInSeconds: 1, fadeOutSeconds: 1, gainDb: -18, trimStartSeconds: 0 },
    profile: {
      loudnessRange: 11,
      lufsTolerance: 1,
      maxTruePeakDbtp: -1,
      normalizationCeilingDb: -1.5,
      targetLufs: -14,
    },
    revision: 3,
    runId: "run_soundtrack_summary",
    schemaVersion: 1,
    sfx: [],
    updatedAt: now,
    voiceover: {
      digest: voiceDigest,
      durationSeconds: 50,
      metadataDigest: voiceDigest,
      path: "production/audio/voiceover.wav",
    },
    ...(input.analysis === false
      ? {}
      : {
          analysis: {
            algorithm: "ffmpeg-loudnorm-two-pass-v1",
            firstPass: {
              integratedLufs: -20,
              loudnessRangeLufs: 5,
              targetOffsetLufs: 0,
              thresholdLufs: -31,
              truePeakDbtp: -2,
            },
            measuredAt: now,
            normalizationMode: "linear" as const,
          },
        }),
  };
}
