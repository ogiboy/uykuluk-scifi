import { describe, expect, it } from "vitest";
import {
  concatenatePcm16Wavs,
  normalizePcm16WavPeak,
  readWavInfo,
  wavFromPcm16,
} from "../src/stages/voice/voiceWav";

describe("voice WAV helpers", () => {
  it("reads RIFF WAV metadata from generated PCM audio", () => {
    const sampleRateHz = 16_000;
    const channels = 1;
    const pcm = Buffer.alloc(sampleRateHz * channels * 2);
    const wav = wavFromPcm16(pcm, sampleRateHz, channels);

    expect(readWavInfo(wav)).toEqual({ channels, durationSeconds: 1, sampleRateHz });
  });

  it("rejects non-WAV and incomplete WAV buffers", () => {
    expect(() => readWavInfo(Buffer.from("not a wav"))).toThrow(/RIFF/i);

    const headerOnly = Buffer.alloc(44);
    headerOnly.write("RIFF", 0, "ascii");
    headerOnly.write("WAVE", 8, "ascii");
    expect(() => readWavInfo(headerOnly)).toThrow(/metadata is incomplete/i);
  });

  it("concatenates compatible PCM16 WAV chunks", () => {
    const first = wavFromPcm16(Buffer.alloc(16_000 * 2), 16_000, 1);
    const second = wavFromPcm16(Buffer.alloc(16_000 * 2), 16_000, 1);

    const stitched = concatenatePcm16Wavs([first, second]);

    expect(readWavInfo(stitched)).toEqual({
      channels: 1,
      durationSeconds: 2,
      sampleRateHz: 16_000,
    });
  });

  it("rejects incompatible WAV chunks", () => {
    const mono = wavFromPcm16(Buffer.alloc(16_000 * 2), 16_000, 1);
    const stereo = wavFromPcm16(Buffer.alloc(16_000 * 4), 16_000, 2);

    expect(() => concatenatePcm16Wavs([mono, stereo])).toThrow(/incompatible/i);
  });

  it("rejects non-canonical PCM byte-rate metadata before stitching", () => {
    const valid = wavFromPcm16(Buffer.alloc(16_000 * 2), 16_000, 1);
    const malformed = Buffer.from(valid);
    malformed.writeUInt32LE(123, 28);

    expect(() => concatenatePcm16Wavs([malformed])).toThrow(/PCM 16-bit/i);
  });

  it("adds deterministic peak headroom to PCM16 Piper audio", () => {
    const pcm = Buffer.alloc(8);
    pcm.writeInt16LE(32_767, 0);
    pcm.writeInt16LE(-32_767, 2);
    pcm.writeInt16LE(10_000, 4);
    pcm.writeInt16LE(-10_000, 6);
    const source = wavFromPcm16(pcm, 16_000, 1);

    const normalized = normalizePcm16WavPeak(source, -1);

    expect(normalized.evidence).toMatchObject({
      applied: true,
      sourcePeakDbfs: 0,
      targetPeakDbfs: -1,
    });
    expect(normalized.evidence.gainDb).toBeCloseTo(-1, 2);
    expect(Math.abs(normalized.buffer.readInt16LE(44))).toBeLessThanOrEqual(29_205);
    expect(readWavInfo(normalized.buffer)).toEqual({
      channels: 1,
      durationSeconds: 4 / 16_000,
      sampleRateHz: 16_000,
    });
  });
});
