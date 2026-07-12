import { describe, expect, it } from "vitest";
import { splitElevenLabsText } from "../src/stages/voice/elevenLabsTextChunks";

describe("ElevenLabs text chunking", () => {
  it("preserves exact narration while preferring sentence boundaries", () => {
    const text = `${"a".repeat(2_800)}.\n\n${"b".repeat(2_800)}.`;

    const chunks = splitElevenLabsText(text, 4_500);

    expect(chunks).toHaveLength(2);
    expect(chunks.join("")).toBe(text);
    expect(chunks[0]).toMatch(/\.\n\n$/);
    expect(chunks.every((chunk) => chunk.length <= 4_500)).toBe(true);
  });

  it("hard-splits a boundary-free segment without dropping characters", () => {
    const text = "x".repeat(5_001);

    const chunks = splitElevenLabsText(text, 4_500);

    expect(chunks.map((chunk) => chunk.length)).toEqual([4_500, 501]);
    expect(chunks.join("")).toBe(text);
  });
});
