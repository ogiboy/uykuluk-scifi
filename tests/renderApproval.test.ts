import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { renderApprovalRefV3, renderApprovalRefV4 } from "../src/stages/render/renderApproval";

describe("render approval reference", () => {
  it("binds the v4 voice, subtitle, visual, and soundtrack input contract", () => {
    const input = {
      renderPlanDigest: "a".repeat(64),
      visualManifestDigest: "f".repeat(64),
      subtitleDigest: "b".repeat(64),
      subtitleMetadataDigest: "c".repeat(64),
      subtitleTimingMode: "elevenlabs-character-aligned" as const,
      voiceMetadataDigest: "d".repeat(64),
      voiceoverAudioDigest: "e".repeat(64),
      voiceoverMode: "elevenlabs",
      voiceoverProductionVoiceCandidate: true,
      voiceoverQuality: "elevenlabs",
      soundtrackManifestDigest: "1".repeat(64),
    };

    expect(renderApprovalRefV4(input)).toBe(
      createHash("sha256")
        .update(JSON.stringify({ contractVersion: 4, ...input }), "utf8")
        .digest("hex"),
    );
    const approvedRef = renderApprovalRefV4(input);
    const changedInputs = [
      { ...input, renderPlanDigest: "f".repeat(64) },
      { ...input, visualManifestDigest: "0".repeat(64) },
      { ...input, subtitleDigest: "f".repeat(64) },
      { ...input, subtitleMetadataDigest: "f".repeat(64) },
      { ...input, subtitleTimingMode: "linear-fallback" as const },
      { ...input, voiceMetadataDigest: "f".repeat(64) },
      { ...input, voiceoverAudioDigest: "f".repeat(64) },
      { ...input, voiceoverMode: "local-piper" },
      { ...input, voiceoverProductionVoiceCandidate: false },
      { ...input, voiceoverQuality: "local-piper" },
      { ...input, soundtrackManifestDigest: "2".repeat(64) },
    ];
    for (const changedInput of changedInputs) {
      expect(renderApprovalRefV4(changedInput)).not.toBe(approvedRef);
    }
  });

  it("retains the v3 helper for legacy deterministic-local approval verification", () => {
    const input = {
      renderPlanDigest: "a".repeat(64),
      visualManifestDigest: "f".repeat(64),
      subtitleDigest: "b".repeat(64),
      subtitleMetadataDigest: "c".repeat(64),
      subtitleTimingMode: "linear-fallback" as const,
      voiceMetadataDigest: "d".repeat(64),
      voiceoverAudioDigest: "e".repeat(64),
      voiceoverMode: "deterministic-local",
      voiceoverProductionVoiceCandidate: false,
      voiceoverQuality: "deterministic-local-reference",
    };

    expect(renderApprovalRefV3(input)).toBe(
      createHash("sha256")
        .update(JSON.stringify({ contractVersion: 3, ...input }), "utf8")
        .digest("hex"),
    );
  });
});
