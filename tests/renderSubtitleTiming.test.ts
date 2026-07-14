import { describe, expect, it } from "vitest";
import {
  buildDraftSubtitleTiming,
  parseSrtDurationSeconds,
} from "../src/stages/render/renderSubtitleTiming";

describe("draft render subtitle timing", () => {
  it("maps the final SRT cue onto the actual voiceover-backed scene window", () => {
    const subtitles = [
      "1",
      "00:00:00,000 --> 00:00:03,250",
      "İlk satır.",
      "",
      "2",
      "00:07:57,039 --> 00:08:01,000",
      "Son satır.",
    ].join("\n");

    const sourceDurationSeconds = parseSrtDurationSeconds(subtitles);
    expect(sourceDurationSeconds).toBe(481);
    expect(buildDraftSubtitleTiming(sourceDurationSeconds, 468.49, "linear-fallback")).toEqual({
      timingMode: "linear-fallback",
      sourceDurationSeconds: 481,
      sceneDurationSeconds: 468.49,
      timeScale: 1.026703,
    });
  });

  it("keeps character-aligned subtitles on their provider timeline", () => {
    expect(buildDraftSubtitleTiming(467.25, 468.49, "elevenlabs-character-aligned")).toEqual({
      timingMode: "elevenlabs-character-aligned",
      sourceDurationSeconds: 467.25,
      sceneDurationSeconds: 468.49,
      timeScale: 1,
    });
  });

  it("rejects character-aligned subtitles that exceed the voiceover window", () => {
    expect(() => buildDraftSubtitleTiming(468.491, 468.49, "elevenlabs-character-aligned")).toThrow(
      /audio window/i,
    );
  });

  it("rejects malformed or empty subtitle timing", () => {
    expect(() => parseSrtDurationSeconds("No timing markers here.")).toThrow(/valid positive/i);
    expect(() => buildDraftSubtitleTiming(0, 10, "linear-fallback")).toThrow(/positive/i);
  });
});
