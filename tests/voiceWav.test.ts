import { describe, expect, it } from "vitest";
import { readWavInfo, wavFromPcm16 } from "../src/stages/voiceWav";

describe("voice WAV helpers", () => {
  it("reads RIFF WAV metadata from generated PCM audio", () => {
    const sampleRateHz = 16_000;
    const channels = 1;
    const pcm = Buffer.alloc(sampleRateHz * channels * 2);
    const wav = wavFromPcm16(pcm, sampleRateHz, channels);

    expect(readWavInfo(wav)).toEqual({
      channels,
      durationSeconds: 1,
      sampleRateHz,
    });
  });

  it("rejects non-WAV and incomplete WAV buffers", () => {
    expect(() => readWavInfo(Buffer.from("not a wav"))).toThrow(/RIFF/i);

    const headerOnly = Buffer.alloc(44);
    headerOnly.write("RIFF", 0, "ascii");
    headerOnly.write("WAVE", 8, "ascii");
    expect(() => readWavInfo(headerOnly)).toThrow(/metadata is incomplete/i);
  });
});
