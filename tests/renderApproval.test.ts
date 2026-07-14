import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { renderApprovalRef } from "../src/stages/render/renderApproval";

describe("render approval reference", () => {
  it("binds the versioned voice, subtitle, and visual input contract", () => {
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
    };

    expect(renderApprovalRef(input)).toBe(
      createHash("sha256")
        .update(JSON.stringify({ contractVersion: 3, ...input }), "utf8")
        .digest("hex"),
    );
    const approvedRef = renderApprovalRef(input);
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
    ];
    for (const changedInput of changedInputs) {
      expect(renderApprovalRef(changedInput)).not.toBe(approvedRef);
    }
  });

  it("uses the v3 approval contract for deterministic-local voice", () => {
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

    expect(renderApprovalRef(input)).toBe(
      createHash("sha256")
        .update(JSON.stringify({ contractVersion: 3, ...input }), "utf8")
        .digest("hex"),
    );
  });
});
