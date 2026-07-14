import { describe, expect, it } from "vitest";
import {
  parsePersistedVoiceoverPreparation,
  prepareVoiceoverText,
} from "../src/stages/voice/voiceoverPreparation";
import { sha256 } from "../src/utils/hash";

describe("voiceover text preparation", () => {
  it("normalizes layout and applies explicit replacements deterministically", () => {
    const result = prepareVoiceoverText({
      runId: "run_voice_preparation",
      sourceText: "  JWST,   L2 noktasında.\r\n\r\n\r\nJWST gözlem yapıyor.  ",
      pronunciationReplacements: { JWST: "James Webb Uzay Teleskobu", L2: "Lagrange iki" },
    });

    expect(result.text).toBe(
      "James Webb Uzay Teleskobu, Lagrange iki noktasında.\n\nJames Webb Uzay Teleskobu gözlem yapıyor.\n",
    );
    expect(result.evidence.schemaVersion).toBe(2);
    expect(result.evidence.source).toEqual({
      path: "production/voiceover.txt",
      sha256: sha256("  JWST,   L2 noktasında.\r\n\r\n\r\nJWST gözlem yapıyor.  "),
      normalizedSha256: sha256("JWST, L2 noktasında.\n\nJWST gözlem yapıyor.\n"),
      normalizedCharacterCount: 43,
      offsetUnit: "utf16-code-unit",
    });
    expect(result.evidence.replacements).toEqual([
      { source: "JWST", replacement: "James Webb Uzay Teleskobu", count: 2 },
      { source: "L2", replacement: "Lagrange iki", count: 1 },
    ]);
    expect(result.evidence.replacementOccurrences).toEqual([
      {
        source: "JWST",
        replacement: "James Webb Uzay Teleskobu",
        sourceSpan: { start: 0, end: 4 },
        preparedSpan: { start: 0, end: 25 },
      },
      {
        source: "L2",
        replacement: "Lagrange iki",
        sourceSpan: { start: 6, end: 8 },
        preparedSpan: { start: 27, end: 39 },
      },
      {
        source: "JWST",
        replacement: "James Webb Uzay Teleskobu",
        sourceSpan: { start: 22, end: 26 },
        preparedSpan: { start: 53, end: 78 },
      },
    ]);
    expect(result.evidence.output.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.parse(result.evidenceText) as unknown).toEqual(result.evidence);
  });

  it("applies longest matches once without cascading replacement output", () => {
    const result = prepareVoiceoverText({
      runId: "run_voice_preparation",
      sourceText: "AB A",
      pronunciationReplacements: { A: "AB", AB: "X", X: "Y" },
    });

    expect(result.text).toBe("X AB\n");
    expect(result.evidence.replacements).toEqual([
      { source: "AB", replacement: "X", count: 1 },
      { source: "A", replacement: "AB", count: 1 },
    ]);
    expect(result.evidence.replacementOccurrences.map((item) => item.sourceSpan)).toEqual([
      { start: 0, end: 2 },
      { start: 3, end: 4 },
    ]);
  });

  it("does not invent replacements when the configured source is absent", () => {
    const result = prepareVoiceoverText({
      runId: "run_voice_preparation",
      sourceText: "Schwarzschild yarıçapı",
      pronunciationReplacements: { JWST: "James Webb Uzay Teleskobu" },
    });

    expect(result.text).toBe("Schwarzschild yarıçapı\n");
    expect(result.evidence.replacements).toEqual([]);
    expect(result.evidence.replacementOccurrences).toEqual([]);
  });

  it("reads persisted schema v1 evidence for existing local runs", () => {
    const parsed = parsePersistedVoiceoverPreparation({
      schemaVersion: 1,
      runId: "run_legacy_voice_preparation",
      createdAt: "2026-07-14T10:00:00.000Z",
      source: { path: "production/voiceover.txt", sha256: "a".repeat(64) },
      output: {
        path: "production/audio/voiceover.prepared.txt",
        sha256: "b".repeat(64),
        characterCount: 12,
      },
      replacements: [],
    });

    expect(parsed.schemaVersion).toBe(1);
  });

  it("applies v2 occurrence invariants after discriminated-union parsing", () => {
    const generated = prepareVoiceoverText({
      runId: "run_invalid_voice_preparation",
      sourceText: "JWST gözlem yapıyor.",
      pronunciationReplacements: { JWST: "James Webb Uzay Teleskobu" },
    });
    const occurrence = generated.evidence.replacementOccurrences[0];
    if (!occurrence) throw new Error("Expected replacement occurrence fixture.");

    expect(() =>
      parsePersistedVoiceoverPreparation({
        ...generated.evidence,
        replacementOccurrences: [
          { ...occurrence, sourceSpan: { ...occurrence.sourceSpan, end: 3 } },
        ],
      }),
    ).toThrow(/spans must match/i);
  });
});
