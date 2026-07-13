import { describe, expect, it } from "vitest";
import { ElevenLabsVoiceCatalogProvider } from "../src/stages/voice/providers/elevenLabsVoiceCatalogProvider";
import {
  fakeCatalogClient as fakeClient,
  catalogModel as model,
  voiceCatalogRequest as request,
  catalogSubscription as subscription,
  catalogVoice as voice,
} from "./elevenLabsVoiceCatalogFixtures";

describe("ElevenLabs voice catalog provider", () => {
  it("normalizes bounded candidates and keeps provider URLs, request IDs, and keys redacted", async () => {
    const client = fakeClient({
      voices: [
        voice({
          voiceId: "voice_general",
          name: "General Voice",
          previewUrl:
            "https://storage.googleapis.com/eleven-public-prod/general.mp3?token=signed-secret",
        }),
        voice({
          voiceId: "voice_turkish",
          name: "Türkçe Ses",
          previewUrl: "https://api.us.elevenlabs.io/v1/voices/voice_turkish/preview",
          verifiedLanguages: [
            {
              language: "tr",
              modelId: "eleven_v3",
              accent: "Istanbul",
              previewUrl:
                "https://storage.googleapis.com/eleven-public-prod/turkish.mp3?token=turkish-secret",
            },
          ],
        }),
      ],
    });
    const provider = new ElevenLabsVoiceCatalogProvider({
      readApiKey: () => "server-secret-key",
      createClient: () => client,
    });

    const catalog = await provider.fetchCatalog(request());

    expect(catalog.candidates.map((candidate) => candidate.voiceId)).toEqual([
      "voice_turkish",
      "voice_general",
    ]);
    expect(catalog).toMatchObject({
      model: {
        modelId: "eleven_v3",
        canDoTextToSpeech: true,
        canUseSpeakerBoost: false,
        maximumTextLengthPerRequest: 5_000,
      },
      pricing: {
        baseUsdPerThousandCharacters: 0.1,
        characterCostMultiplier: 1,
        costDiscountMultiplier: 1,
        effectiveUsdPerThousandCharacters: 0.1,
      },
      subscription: { tier: "free", productionUseStatus: "blocked-free-tier" },
    });
    expect(catalog.candidates[0]).toMatchObject({
      preview: {
        available: true,
        source: "verified-language",
        sourceClass: "eleven-public-prod",
        urlSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
      productionEligibility: { status: "preview-only" },
    });
    const persistedProjection = JSON.stringify(catalog);
    expect(persistedProjection).not.toContain("server-secret-key");
    expect(persistedProjection).not.toContain("request-id-secret");
    expect(persistedProjection).not.toContain("signed-secret");
    expect(persistedProjection).not.toContain("turkish-secret");
    expect(catalog.requestIdHashes).toEqual(
      expect.arrayContaining([expect.stringMatching(/^[a-f0-9]{64}$/)]),
    );
  });

  it("marks custom-rate and live-moderated voices blocked", async () => {
    const client = fakeClient({
      subscription: subscription({ tier: "creator" }),
      voices: [
        voice({ voiceId: "voice_custom_rate", sharing: { liveModerationEnabled: true, rate: 2 } }),
      ],
    });
    const provider = new ElevenLabsVoiceCatalogProvider({
      readApiKey: () => "test-api-key-1234567890",
      createClient: () => client,
    });

    const catalog = await provider.fetchCatalog(request());

    expect(catalog.candidates[0].productionEligibility).toMatchObject({
      status: "blocked",
      reasons: expect.arrayContaining([
        expect.stringContaining("Custom-rate"),
        expect.stringContaining("Live-moderated"),
      ]),
    });
  });

  it("fails closed when the configured model lacks Turkish TTS capability", async () => {
    const client = fakeClient({
      models: [model({ canDoTextToSpeech: false, languages: [{ languageId: "en" }] })],
    });
    const provider = new ElevenLabsVoiceCatalogProvider({
      readApiKey: () => "test-api-key-1234567890",
      createClient: () => client,
    });

    await expect(provider.fetchCatalog(request())).rejects.toThrow(
      "not enabled for text-to-speech",
    );
  });

  it("fails closed when configured chunking exceeds the live model limit", async () => {
    const client = fakeClient({ models: [model({ maximumTextLengthPerRequest: 4_000 })] });
    const provider = new ElevenLabsVoiceCatalogProvider({
      readApiKey: () => "test-api-key-1234567890",
      createClient: () => client,
    });

    await expect(provider.fetchCatalog(request())).rejects.toThrow(
      "request length exceeds the current model limit",
    );
  });

  it("rejects malformed pagination and redacts unexpected provider errors", async () => {
    const malformed = fakeClient({ voices: [] });
    malformed.searchVoices = async () => ({
      data: { voices: [], hasMore: true },
      requestId: "request-id-secret",
    });
    const malformedProvider = new ElevenLabsVoiceCatalogProvider({
      readApiKey: () => "test-api-key-1234567890",
      createClient: () => malformed,
    });
    await expect(malformedProvider.fetchCatalog(request())).rejects.toThrow(
      "pagination metadata is invalid",
    );

    const leaking = fakeClient({ voices: [] });
    leaking.listModels = async () => {
      throw new Error("upstream xi-api-key=must-not-leak");
    };
    const leakingProvider = new ElevenLabsVoiceCatalogProvider({
      readApiKey: () => "test-api-key-1234567890",
      createClient: () => leaking,
    });
    const failure = await leakingProvider.fetchCatalog(request()).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toBe("ElevenLabs voice catalog request failed safely.");
    expect((failure as Error).message).not.toContain("must-not-leak");
  });
});
