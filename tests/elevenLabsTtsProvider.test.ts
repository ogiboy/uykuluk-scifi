import { describe, expect, it, vi } from "vitest";
import { estimateElevenLabsTtsUsd } from "../src/costs/elevenLabsPricing";
import { ElevenLabsTtsProvider } from "../src/stages/voice/providers/elevenLabsTtsProvider";
import {
  baseElevenLabsTtsConfig,
  executeElevenLabsAdapter,
  fixtureWav,
} from "./elevenLabsTtsProviderTestHelpers";

describe("ElevenLabs TTS provider", () => {
  it("fails before reservation when the server credential is missing", () => {
    const provider = new ElevenLabsTtsProvider(baseElevenLabsTtsConfig, {
      readApiKey: () => undefined,
    });

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
    const provider = new ElevenLabsTtsProvider(baseElevenLabsTtsConfig, {
      readApiKey: () => "secret-test-key",
      createClient: () => ({ convertWithTimestamps }),
    });
    provider.assertReady();

    const outcome = await executeElevenLabsAdapter(provider, "Merhaba", 10_000);

    expect(outcome).toMatchObject({
      kind: "success",
      value: {
        quality: "elevenlabs",
        provider: {
          service: "elevenlabs",
          modelId: baseElevenLabsTtsConfig.modelId,
          voiceId: baseElevenLabsTtsConfig.voiceId,
          outputFormat: baseElevenLabsTtsConfig.outputFormat,
        },
      },
    });
    expect(JSON.stringify(outcome)).not.toContain("secret-test-key");
    expect(convertWithTimestamps).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Merhaba",
        voiceId: baseElevenLabsTtsConfig.voiceId,
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
    const provider = new ElevenLabsTtsProvider(baseElevenLabsTtsConfig, {
      readApiKey: () => "secret-test-key",
      createClient: () => ({ convertWithTimestamps }),
    });
    const text = `${"a".repeat(3_500)}. ${"b".repeat(2_498)}`;

    const outcome = await executeElevenLabsAdapter(provider, text, 600_000);

    expect(outcome).toMatchObject({
      kind: "success",
      actualUsdMicros: 600_000,
      providerRequestId: "request_1",
      value: { durationSeconds: 2 },
    });
    if (outcome.kind !== "success") throw new Error("Expected successful stitched voice output.");
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

  it("estimates character pricing in stable USD micro-units", () => {
    expect(estimateElevenLabsTtsUsd("a".repeat(1_000), 0.1)).toBe(0.1);
    expect(estimateElevenLabsTtsUsd("a".repeat(555), 0.1)).toBe(0.0555);
  });
});
