import { describe, expect, it, vi } from "vitest";
import {
  ElevenLabsTtsProvider,
  estimateElevenLabsTtsUsd,
} from "../src/stages/voice/providers/elevenLabsTtsProvider";
import { wavFromPcm16 } from "../src/stages/voice/voiceWav";

const baseConfig = {
  voiceId: "voice_test",
  modelId: "eleven_multilingual_v2",
  outputFormat: "wav_24000" as const,
  timeoutMs: 30_000,
  maxRetries: 1,
  usdPerThousandCharacters: 0.1,
};

describe("ElevenLabs TTS provider", () => {
  it("fails before reservation when the server credential is missing", () => {
    const provider = new ElevenLabsTtsProvider(baseConfig, { readApiKey: () => undefined });

    expect(() => provider.assertReady()).toThrow(/ELEVENLABS_API_KEY/);
  });

  it("returns validated WAV and alignment through a reserved adapter without exposing the key", async () => {
    const convertWithTimestamps = vi.fn(async () => ({
      audioBase64: fixtureWav().toString("base64"),
      alignment: {
        characters: ["M", "e", "r", "h", "a", "b", "a"],
        characterStartTimesSeconds: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6],
        characterEndTimesSeconds: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7],
      },
    }));
    const provider = new ElevenLabsTtsProvider(baseConfig, {
      readApiKey: () => "secret-test-key",
      createClient: () => ({ convertWithTimestamps }),
    });
    provider.assertReady();

    const outcome = await provider
      .createReservedAdapter({ runId: "run_test", text: "Merhaba" })
      .execute({
        reservationId: "reservation_test",
        operationId: "operation_test",
        provider: "elevenlabs",
        model: baseConfig.modelId,
        maxUsdMicros: 10_000,
        signal: new AbortController().signal,
      });

    expect(outcome).toMatchObject({
      kind: "success",
      value: {
        quality: "elevenlabs",
        provider: {
          service: "elevenlabs",
          modelId: baseConfig.modelId,
          voiceId: baseConfig.voiceId,
          outputFormat: baseConfig.outputFormat,
        },
      },
    });
    expect(JSON.stringify(outcome)).not.toContain("secret-test-key");
    expect(convertWithTimestamps).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Merhaba", voiceId: baseConfig.voiceId }),
    );
  });

  it("does not send when the exact reservation is below the estimated call cost", async () => {
    const convertWithTimestamps = vi.fn();
    const provider = new ElevenLabsTtsProvider(baseConfig, {
      readApiKey: () => "secret-test-key",
      createClient: () => ({ convertWithTimestamps }),
    });

    const outcome = await provider
      .createReservedAdapter({ runId: "run_test", text: "a".repeat(1_000) })
      .execute({
        reservationId: "reservation_test",
        operationId: "operation_test",
        provider: "elevenlabs",
        model: baseConfig.modelId,
        maxUsdMicros: 99_999,
        signal: new AbortController().signal,
      });

    expect(outcome).toEqual({ kind: "definitely-not-sent", reason: "adapter-validation" });
    expect(convertWithTimestamps).not.toHaveBeenCalled();
  });

  it("estimates character pricing in stable USD micro-units", () => {
    expect(estimateElevenLabsTtsUsd("a".repeat(1_000), 0.1)).toBe(0.1);
    expect(estimateElevenLabsTtsUsd("a".repeat(555), 0.1)).toBe(0.0555);
  });
});

function fixtureWav(): Buffer {
  const pcm = Buffer.alloc(24_000 * 2);
  for (let index = 0; index < 24_000; index += 1) {
    pcm.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 220 * index) / 24_000) * 2_000), index * 2);
  }
  return wavFromPcm16(pcm, 24_000, 1);
}
