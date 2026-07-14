import { describe, expect, it } from "vitest";
import { assertVoiceoverAlignment } from "../src/stages/voice/voiceoverAlignmentValidation";
import { voiceoverAudioMetaSchema } from "../src/stages/voice/voiceoverEvidence";
import { useTempProject } from "./helpers";

describe("voiceover alignment validation", () => {
  useTempProject();

  it("validates independently present normalized alignment evidence", async () => {
    const digest = "a".repeat(64);
    const normalizedPath = "production/audio/alignment.normalized.json";
    const meta = voiceoverAudioMetaSchema.parse({
      schemaVersion: 2,
      runId: "run_normalized_only",
      createdAt: "2026-07-14T10:00:00.000Z",
      mode: "deterministic-local",
      quality: "deterministic-local-reference",
      source: { path: "production/voiceover.txt", sha256: digest, wordCount: 1 },
      renderPlan: { path: "production/render_plan.json", digest },
      output: {
        path: "production/audio/voiceover.wav",
        sha256: digest,
        bytes: 44,
        durationSeconds: 1,
        sampleRateHz: 24_000,
        channels: 1,
      },
      normalizedAlignment: { path: normalizedPath, sha256: digest, characterCount: 1 },
      subtitle: {
        timingMode: "linear-fallback",
        path: "production/subtitles.srt",
        sha256: digest,
        metadataPath: "production/production_package.meta.json",
        metadataSha256: digest,
        cueCount: 1,
        sourceDurationSeconds: 1,
      },
    });

    await expect(
      assertVoiceoverAlignment({ runId: meta.runId, artifacts: [normalizedPath] }, meta),
    ).rejects.toThrow(/normalized alignment artifact is missing/i);
  });
});
