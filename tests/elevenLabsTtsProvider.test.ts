import { describe, expect, it, vi } from "vitest";
import { estimateElevenLabsTtsUsd } from "../src/costs/elevenLabsPricing";
import { stitchElevenLabsAlignments } from "../src/stages/voice/elevenLabsAlignment";
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
    if (outcome.kind !== "success") throw new Error("Expected successful voice output.");
    expect(outcome.value.alignment?.characters.join("")).toBe("Merhaba");
    expect(outcome.value.normalizedAlignment).toBeUndefined();
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

  it("chunks long v3 narration and stitches WAV audio and alignment without request stitching", async () => {
    const convertWithTimestamps = vi.fn(async (input: { text: string }) => {
      const index = convertWithTimestamps.mock.calls.length - 1;
      const characters = Array.from(input.text);
      return {
        audioBase64: fixtureWav().toString("base64"),
        characterCost: characters.length,
        requestId: `request_${index}`,
        alignment: {
          characters,
          characterStartTimesSeconds: characters.map(
            (_, characterIndex) => characterIndex * 0.0001,
          ),
          characterEndTimesSeconds: characters.map(
            (_, characterIndex) => (characterIndex + 1) * 0.0001,
          ),
        },
        normalizedAlignment: {
          characters: characters.map((character) => character.toUpperCase()),
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
    expect(outcome.value.normalizedAlignment?.characters.join("")).toBe(text.toUpperCase());
    expect(outcome.value.alignment?.characterStartTimesSeconds.at(-1)).toBeGreaterThan(1);
    expect(convertWithTimestamps).toHaveBeenCalledTimes(2);
    expect(convertWithTimestamps.mock.calls[0][0]).toMatchObject({ seed: 42 });
    expect(convertWithTimestamps.mock.calls[1][0]).toMatchObject({ seed: 43 });
    for (const [request] of convertWithTimestamps.mock.calls) {
      expect(request).not.toHaveProperty("previousRequestIds");
      expect(request).not.toHaveProperty("previousText");
      expect(request).not.toHaveProperty("nextText");
    }
  });

  it("fails closed when only normalized alignment is returned", async () => {
    const characters = Array.from("Merhaba");
    const provider = new ElevenLabsTtsProvider(baseElevenLabsTtsConfig, {
      readApiKey: () => "secret-test-key",
      createClient: () => ({
        convertWithTimestamps: vi.fn(async () => ({
          audioBase64: fixtureWav().toString("base64"),
          characterCost: characters.length,
          normalizedAlignment: {
            characters,
            characterStartTimesSeconds: characters.map((_, index) => index * 0.1),
            characterEndTimesSeconds: characters.map((_, index) => (index + 1) * 0.1),
          },
        })),
      }),
    });

    await expect(executeElevenLabsAdapter(provider, "Merhaba", 10_000)).resolves.toMatchObject({
      kind: "unknown",
      reason: "provider-error",
      requestEvidence: [expect.objectContaining({ reportedUnits: characters.length })],
    });
  });

  it("ignores malformed normalized diagnostic alignment when original alignment is valid", async () => {
    const characters = Array.from("Merhaba");
    const provider = new ElevenLabsTtsProvider(baseElevenLabsTtsConfig, {
      readApiKey: () => "secret-test-key",
      createClient: () => ({
        convertWithTimestamps: vi.fn(async () => ({
          audioBase64: fixtureWav().toString("base64"),
          characterCost: characters.length,
          alignment: {
            characters,
            characterStartTimesSeconds: characters.map((_, index) => index * 0.1),
            characterEndTimesSeconds: characters.map((_, index) => (index + 1) * 0.1),
          },
          normalizedAlignment: {
            characters,
            characterStartTimesSeconds: characters.map(() => 0.2),
            characterEndTimesSeconds: characters.map(() => 0.1),
          },
        })),
      }),
    });

    const outcome = await executeElevenLabsAdapter(provider, "Merhaba", 10_000);

    expect(outcome.kind).toBe("success");
    if (outcome.kind !== "success") throw new Error("Expected successful voice output.");
    expect(outcome.value.alignment?.characters.join("")).toBe("Merhaba");
    expect(outcome.value.normalizedAlignment).toBeUndefined();
  });

  it("fails closed when original alignment text differs from the requested chunk", async () => {
    const characters = Array.from("Merhabx");
    const provider = new ElevenLabsTtsProvider(baseElevenLabsTtsConfig, {
      readApiKey: () => "secret-test-key",
      createClient: () => ({
        convertWithTimestamps: vi.fn(async () => ({
          audioBase64: fixtureWav().toString("base64"),
          characterCost: characters.length,
          alignment: {
            characters,
            characterStartTimesSeconds: characters.map((_, index) => index * 0.1),
            characterEndTimesSeconds: characters.map((_, index) => (index + 1) * 0.1),
          },
        })),
      }),
    });

    await expect(executeElevenLabsAdapter(provider, "Merhaba", 10_000)).resolves.toMatchObject({
      kind: "unknown",
      reason: "provider-error",
    });
  });

  it("rejects mismatched alignment and audio chunk counts", () => {
    expect(() => stitchElevenLabsAlignments([], [fixtureWav()])).toThrow(
      /alignment\/audio chunk count mismatch/i,
    );
  });

  it("estimates character pricing in stable USD micro-units", () => {
    expect(estimateElevenLabsTtsUsd("a".repeat(1_000), 0.1)).toBe(0.1);
    expect(estimateElevenLabsTtsUsd("a".repeat(555), 0.1)).toBe(0.0555);
  });
});
