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
    expect(buildDraftSubtitleTiming(sourceDurationSeconds, 468.49)).toEqual({
      sourceDurationSeconds: 481,
      sceneDurationSeconds: 468.49,
      timeScale: 1.026703,
    });
  });

  it("rejects malformed or empty subtitle timing", () => {
    expect(() => parseSrtDurationSeconds("No timing markers here.")).toThrow(/valid positive/i);
    expect(() => buildDraftSubtitleTiming(0, 10)).toThrow(/positive/i);
  });
});
