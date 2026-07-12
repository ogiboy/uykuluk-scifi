import { describe, expect, it } from "vitest";
import { defaultConfig } from "../src/config/config";
import { producerConfigSchema } from "../src/config/schema";

describe("ElevenLabs config", () => {
  it("defaults hosted production TTS to Turkish Eleven v3-safe settings", () => {
    expect(defaultConfig.providers.tts.elevenLabs).toMatchObject({
      modelId: "eleven_v3",
      languageCode: "tr",
      applyTextNormalization: "auto",
      maxCharactersPerRequest: 4_500,
      outputFormat: "wav_24000",
      maxRetries: 0,
    });
  });

  it("rejects v3 Speaker Boost configuration", () => {
    expect(() =>
      producerConfigSchema.parse({
        ...defaultConfig,
        providers: {
          ...defaultConfig.providers,
          tts: {
            ...defaultConfig.providers.tts,
            elevenLabs: {
              ...defaultConfig.providers.tts.elevenLabs,
              voiceSettings: { useSpeakerBoost: true },
            },
          },
        },
      }),
    ).toThrow(/Speaker Boost/);
  });

  it("rejects automatic retries for paid TTS calls without an idempotency key", () => {
    expect(() =>
      producerConfigSchema.parse({
        ...defaultConfig,
        providers: {
          ...defaultConfig.providers,
          tts: {
            ...defaultConfig.providers.tts,
            elevenLabs: { ...defaultConfig.providers.tts.elevenLabs, maxRetries: 1 },
          },
        },
      }),
    ).toThrow();
  });

  it("keeps explicit legacy or alternative model ids config-compatible", () => {
    const parsed = producerConfigSchema.parse({
      ...defaultConfig,
      providers: {
        ...defaultConfig.providers,
        tts: {
          ...defaultConfig.providers.tts,
          elevenLabs: { ...defaultConfig.providers.tts.elevenLabs, modelId: "eleven_flash_v2_5" },
        },
      },
    });

    expect(parsed.providers.tts.elevenLabs.modelId).toBe("eleven_flash_v2_5");
  });
});
