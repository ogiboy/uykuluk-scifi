import { describe, expect, it } from "vitest";
import { canonicalVisualGenerationDigest } from "../src/stages/visuals/visualGenerationDigest";
import { canonicalVoiceEvidenceDigest } from "../src/stages/voice/catalog/voiceCatalogDigest";

describe("canonical JSON evidence digest", () => {
  it("keeps wrapper digests key-order independent and domain consistent", () => {
    const left = { z: [3, { b: true, a: "value" }], omitted: undefined, a: 1 };
    const right = { a: 1, z: [3, { a: "value", b: true }] };

    expect(canonicalVoiceEvidenceDigest(left)).toBe(canonicalVoiceEvidenceDigest(right));
    expect(canonicalVisualGenerationDigest(left)).toBe(canonicalVoiceEvidenceDigest(left));
  });

  it("preserves domain-specific error messages", () => {
    expect(() => canonicalVoiceEvidenceDigest(Number.NaN)).toThrow(
      "Canonical voice evidence cannot contain a non-finite number.",
    );
    expect(() => canonicalVoiceEvidenceDigest(Symbol("unsupported"))).toThrow(
      "Canonical voice evidence contains an unsupported value.",
    );
    expect(() => canonicalVisualGenerationDigest(Number.POSITIVE_INFINITY)).toThrow(
      "Canonical visual generation evidence requires finite numbers.",
    );
    expect(() => canonicalVisualGenerationDigest(() => undefined)).toThrow(
      "Canonical visual generation evidence contains an unsupported value.",
    );
  });
});
