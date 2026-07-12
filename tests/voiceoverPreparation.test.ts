import { describe, expect, it } from "vitest";
import { prepareVoiceoverText } from "../src/stages/voice/voiceoverPreparation";

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
    expect(result.evidence.replacements).toEqual([
      { source: "JWST", replacement: "James Webb Uzay Teleskobu", count: 2 },
      { source: "L2", replacement: "Lagrange iki", count: 1 },
    ]);
    expect(result.evidence.output.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.parse(result.evidenceText) as unknown).toEqual(result.evidence);
  });

  it("does not invent replacements when the configured source is absent", () => {
    const result = prepareVoiceoverText({
      runId: "run_voice_preparation",
      sourceText: "Schwarzschild yarıçapı",
      pronunciationReplacements: { JWST: "James Webb Uzay Teleskobu" },
    });

    expect(result.text).toBe("Schwarzschild yarıçapı\n");
    expect(result.evidence.replacements).toEqual([]);
  });
});
