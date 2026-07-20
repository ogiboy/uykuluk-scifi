import { describe, expect, it } from "vitest";
import { draftRenderManifestSchema } from "../src/stages/render/renderEvidenceContracts";

const digest = "a".repeat(64);
const createdAt = "2026-07-20T00:00:00.000Z";

function manifestV11(): Record<string, unknown> {
  const asset = { role: "background", path: "assets/background.jpg", digest };
  return {
    schemaVersion: 11,
    runId: "run_render_evidence",
    createdAt,
    renderPlan: { path: "production/render_plan.json", digest, visualManifestDigest: digest },
    voiceoverAudio: {
      path: "production/audio/voiceover.wav",
      digest,
      metadataDigest: digest,
      mode: "local-piper",
      productionVoiceCandidate: true,
      quality: "local-piper",
    },
    subtitles: {
      timingMode: "linear-fallback",
      path: "production/subtitles.srt",
      sha256: digest,
      metadataPath: "production/production_package.meta.json",
      metadataSha256: digest,
      cueCount: 1,
      sourceDurationSeconds: 1,
    },
    renderApproval: { approvalId: "approval_render", approvedRef: digest, contractVersion: 4 },
    soundtrack: {
      manifestPath: "production/audio/soundtrack/manifest.json",
      manifestDigest: digest,
    },
    mastering: {
      path: "production/render/audio_mastering.json",
      sha256: digest,
      firstPass: measurement(),
      outputMeasurement: measurement(),
      passed: true,
    },
    encoding: {
      container: "mp4",
      videoCodec: "h264",
      audioCodec: "aac",
      audioSampleRateHz: 48000,
      audioChannels: 2,
    },
    timeline: [{ segment: "scene", sceneIndex: 1, durationSeconds: 1, backgroundAsset: asset }],
    timing: {
      introDurationSeconds: 0,
      sceneAudioDurationSeconds: 1,
      outroDurationSeconds: 0,
      totalDurationSeconds: 1,
    },
    subtitleTiming: {
      timingMode: "linear-fallback",
      sourceDurationSeconds: 1,
      sceneDurationSeconds: 1,
      timeScale: 1,
    },
    ffmpegTimelineInputs: [
      { segment: "scene", sceneIndex: 1, durationSeconds: 1, asset, source: "background" },
    ],
    composition: { overlays: [], reviewChecklist: ["Review locally."] },
    output: { path: "production/render/draft.mp4", sha256: digest, bytes: 1, durationSeconds: 1 },
    chapterDraft: {
      jsonPath: "production/render/youtube_chapters.json",
      markdownPath: "production/render/youtube_chapters.md",
      jsonSha256: digest,
      markdownSha256: digest,
    },
    ffmpeg: { binary: "ffmpeg", args: [], reviewArgs: [], reviewCommand: "ffmpeg" },
    mediaProbe: {
      binary: "ffprobe",
      durationSeconds: 1,
      formatName: "mov,mp4,m4a,3gp,3g2,mj2",
      video: { codecName: "h264", width: 1280, height: 720 },
      audio: { codecName: "aac", sampleRateHz: 48000, channels: 2 },
    },
  };
}

function measurement(): Record<string, number> {
  return {
    integratedLufs: -14,
    truePeakDbtp: -1.5,
    loudnessRangeLufs: 5,
    thresholdLufs: -24,
    targetOffsetLufs: 0,
  };
}

describe("draft render evidence v11 contract", () => {
  it("requires v4 approval, soundtrack, mastering, and encoding evidence", () => {
    expect(draftRenderManifestSchema.parse(manifestV11()).schemaVersion).toBe(11);

    const missingEncoding = manifestV11();
    delete missingEncoding.encoding;
    expect(() => draftRenderManifestSchema.parse(missingEncoding)).toThrow();

    for (const requiredField of ["soundtrack", "mastering"] as const) {
      const incomplete = manifestV11();
      delete incomplete[requiredField];
      expect(() => draftRenderManifestSchema.parse(incomplete)).toThrow();
    }

    const legacyApproval = manifestV11();
    legacyApproval.renderApproval = { approvalId: "approval_render", approvedRef: digest };
    expect(() => draftRenderManifestSchema.parse(legacyApproval)).toThrow();
  });
});
