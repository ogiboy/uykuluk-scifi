import { describe, expect, it } from "vitest";
import { srtToWebVtt } from "../apps/studio/src/lib/artifacts/studioMediaArtifacts";

describe("SRT to WebVTT conversion", () => {
  it("normalizes line endings and timestamp separators", () => {
    expect(srtToWebVtt("1\r\n00:00:00,000 --> 00:00:01,250\r\nAçılış\r\n")).toBe(
      "WEBVTT\n\n1\n00:00:00.000 --> 00:00:01.250\nAçılış\n",
    );
  });
});
