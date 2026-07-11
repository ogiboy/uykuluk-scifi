import { describe, expect, it } from "vitest";
import {
  appendBoundedStudioCliOutput,
  studioCliHttpStatus,
  studioCliResultStatus,
} from "../apps/studio/src/lib/studioCliProcessLimits";

describe("Studio CLI process limits", () => {
  it("retains output up to the configured limit without silently dropping its prefix", () => {
    expect(appendBoundedStudioCliOutput("abc", "def", 5)).toEqual({
      exceeded: true,
      value: "abcde",
    });
    expect(appendBoundedStudioCliOutput("abc", "de", 5)).toEqual({
      exceeded: false,
      value: "abcde",
    });
  });

  it("distinguishes timeout, output-limit, and process exit statuses", () => {
    expect(studioCliResultStatus("timeout", null)).toBe(124);
    expect(studioCliResultStatus("output-limit", null)).toBe(413);
    expect(studioCliResultStatus(null, 9)).toBe(9);
    expect(studioCliResultStatus(null, null)).toBe(1);
    expect(studioCliHttpStatus(124)).toBe(504);
    expect(studioCliHttpStatus(413)).toBe(413);
    expect(studioCliHttpStatus(1)).toBe(409);
  });
});
