import { describe, expect, it } from "vitest";
import {
  assertMasteringOutput,
  firstPassLoudnormFilter,
  parseLoudnormMeasurement,
  secondPassLoudnormFilter,
} from "../src/stages/render/audioMastering.js";

const validMeasurement = {
  integratedLufs: -14.2,
  truePeakDbtp: -1.3,
  loudnessRangeLufs: 6.1,
  thresholdLufs: -24.4,
  targetOffsetLufs: 0.2,
};

describe("audio mastering", () => {
  it("builds deterministic first- and measured second-pass loudnorm filters", () => {
    expect(firstPassLoudnormFilter()).toBe("loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json");
    expect(secondPassLoudnormFilter(validMeasurement)).toContain(
      "measured_I=-14.2:measured_TP=-1.3:measured_LRA=6.1:measured_thresh=-24.4:offset=0.2:linear=true",
    );
  });

  it("parses the final complete loudnorm object from noisy FFmpeg stderr", () => {
    const stderr = `frame=1\n{"input_i":"-20.0"}\nnoise\n${JSON.stringify({
      input_i: "-14.2",
      input_tp: "-1.3",
      input_lra: "6.1",
      input_thresh: "-24.4",
      target_offset: "0.2",
    })}\n`;

    expect(parseLoudnormMeasurement(stderr)).toEqual(validMeasurement);
  });

  it("rejects incomplete or non-finite loudnorm output", () => {
    expect(() => parseLoudnormMeasurement('{"input_i":"-14","input_tp":"inf"}')).toThrow(
      /complete loudnorm/i,
    );
  });

  it("accepts output inside the publish-quality envelope", () => {
    expect(() => assertMasteringOutput(validMeasurement)).not.toThrow();
  });

  it.each([
    [{ ...validMeasurement, integratedLufs: -15.1 }, /integrated loudness/i],
    [{ ...validMeasurement, truePeakDbtp: -0.9 }, /true peak/i],
    [{ ...validMeasurement, loudnessRangeLufs: 11.1 }, /loudness range/i],
  ])("rejects output outside the mastering envelope", (measurement, expected) => {
    expect(() => assertMasteringOutput(measurement)).toThrow(expected);
  });
});
