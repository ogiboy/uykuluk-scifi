import { describe, expect, it, vi } from "vitest";
import { estimateElevenLabsTtsUsd } from "../src/costs/elevenLabsPricing";
import { ElevenLabsTtsProvider } from "../src/stages/voice/providers/elevenLabsTtsProvider";
import { wavFromPcm16 } from "../src/stages/voice/voiceWav";

const baseConfig = {
  voiceId: "voice_test",
  modelId: "eleven_v3" as const,
  languageCode: "tr" as const,
  applyTextNormalization: "auto" as const,
  seed: 42,
  maxCharactersPerRequest: 4_500,
  outputFormat: "wav_24000" as const,
  timeoutMs: 30_000,
  maxRetries: 0,
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
      characterCost: 7,
      requestId: "request_test",
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
      expect.objectContaining({
        text: "Merhaba",
        voiceId: baseConfig.voiceId,
        modelId: "eleven_v3",
        languageCode: "tr",
        applyTextNormalization: "auto",
        seed: 42,
      }),
    );
  });

  it("chunks long v3 narration and stitches request context, WAV audio, and alignment", async () => {
    const convertWithTimestamps = vi.fn(async (input: { text: string }) => {
      const index = convertWithTimestamps.mock.calls.length - 1;
      const characters = Array.from(input.text);
      return {
        audioBase64: fixtureWav().toString("base64"),
        characterCost: characters.length,
        requestId: `request_${index}`,
        normalizedAlignment: {
          characters,
          characterStartTimesSeconds: characters.map(
            (_, characterIndex) => characterIndex * 0.0001,
          ),
          characterEndTimesSeconds: characters.map(
            (_, characterIndex) => (characterIndex + 1) * 0.0001,
          ),
        },
      };
    });
    const provider = new ElevenLabsTtsProvider(baseConfig, {
      readApiKey: () => "secret-test-key",
      createClient: () => ({ convertWithTimestamps }),
    });
    const text = `${"a".repeat(3_500)}. ${"b".repeat(2_498)}`;

    const outcome = await provider
      .createReservedAdapter({ runId: "run_test", text })
      .execute({
        reservationId: "reservation_test",
        operationId: "operation_test",
        provider: "elevenlabs",
        model: baseConfig.modelId,
        maxUsdMicros: 600_000,
        signal: new AbortController().signal,
      });

    expect(outcome).toMatchObject({
      kind: "success",
      actualUsdMicros: 600_000,
      providerRequestId: "request_1",
      value: { durationSeconds: 2 },
    });
    if (outcome.kind !== "success") {
      throw new Error("Expected successful stitched voice output.");
    }
    expect(outcome.value.alignment?.characters.join("")).toBe(text);
    expect(outcome.value.alignment?.characterStartTimesSeconds.at(-1)).toBeGreaterThan(1);
    expect(convertWithTimestamps).toHaveBeenCalledTimes(2);
    expect(convertWithTimestamps.mock.calls[0][0]).toMatchObject({
      nextText: expect.any(String),
      previousRequestIds: undefined,
      seed: 42,
    });
    expect(convertWithTimestamps.mock.calls[1][0]).toMatchObject({
      previousRequestIds: ["request_0"],
      seed: 43,
    });
  });

  it("marks a sent generation indeterminate when provider cost headers are missing", async () => {
    const provider = new ElevenLabsTtsProvider(baseConfig, {
      readApiKey: () => "secret-test-key",
      createClient: () => ({
        convertWithTimestamps: vi.fn(async () => ({
          audioBase64: fixtureWav().toString("base64"),
          requestId: "request_without_cost",
          alignment: {
            characters: ["a"],
            characterStartTimesSeconds: [0],
            characterEndTimesSeconds: [0.1],
          },
        })),
      }),
    });

    await expect(
      provider
        .createReservedAdapter({ runId: "run_test", text: "a" })
        .execute({
          reservationId: "reservation_test",
          operationId: "operation_test",
          provider: "elevenlabs",
          model: baseConfig.modelId,
          maxUsdMicros: 1_000,
          signal: new AbortController().signal,
        }),
    ).resolves.toEqual({
      kind: "unknown",
      reason: "indeterminate",
      providerRequestId: "request_without_cost",
    });
  });

  it("does not settle success when provider character cost exceeds the approved cap", async () => {
    const provider = new ElevenLabsTtsProvider(baseConfig, {
      readApiKey: () => "secret-test-key",
      createClient: () => ({
        convertWithTimestamps: vi.fn(async () => ({
          audioBase64: fixtureWav().toString("base64"),
          characterCost: 2,
          requestId: "request_over_cap",
          alignment: {
            characters: ["a"],
            characterStartTimesSeconds: [0],
            characterEndTimesSeconds: [0.1],
          },
        })),
      }),
    });

    await expect(
      provider
        .createReservedAdapter({ runId: "run_test", text: "a" })
        .execute({
          reservationId: "reservation_test",
          operationId: "operation_test",
          provider: "elevenlabs",
          model: baseConfig.modelId,
          maxUsdMicros: 100,
          signal: new AbortController().signal,
        }),
    ).resolves.toEqual({
      kind: "unknown",
      reason: "indeterminate",
      providerRequestId: "request_over_cap",
    });
  });

  it("keeps the last provider request id when a later chunk fails", async () => {
    const convertWithTimestamps = vi
      .fn()
      .mockResolvedValueOnce({
        audioBase64: fixtureWav().toString("base64"),
        characterCost: 4_500,
        requestId: "request_first_chunk",
        alignment: {
          characters: ["a"],
          characterStartTimesSeconds: [0],
          characterEndTimesSeconds: [0.1],
        },
      })
      .mockRejectedValueOnce(new Error("provider unavailable"));
    const provider = new ElevenLabsTtsProvider(baseConfig, {
      readApiKey: () => "secret-test-key",
      createClient: () => ({ convertWithTimestamps }),
    });

    await expect(
      provider
        .createReservedAdapter({ runId: "run_test", text: "a".repeat(4_501) })
        .execute({
          reservationId: "reservation_test",
          operationId: "operation_test",
          provider: "elevenlabs",
          model: baseConfig.modelId,
          maxUsdMicros: 450_100,
          signal: new AbortController().signal,
        }),
    ).resolves.toEqual({
      kind: "unknown",
      reason: "provider-error",
      providerRequestId: "request_first_chunk",
    });
  });

  it("rejects Speaker Boost before reservation for Eleven v3", () => {
    const provider = new ElevenLabsTtsProvider(
      { ...baseConfig, voiceSettings: { useSpeakerBoost: true } },
      { readApiKey: () => "secret-test-key" },
    );

    expect(() => provider.assertReady()).toThrow(/Speaker Boost/);
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
