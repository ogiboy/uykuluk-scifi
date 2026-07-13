import { describe, expect, it } from "vitest";
import { ElevenLabsVoicePreviewProvider } from "../src/stages/voice/providers/elevenLabsVoicePreviewProvider";
import { sha256 } from "../src/utils/hash";
import { fakeCatalogClient, voiceCatalogRequest } from "./elevenLabsVoiceCatalogFixtures";
import { defaultCatalogVoice, successfulCatalogProvider } from "./voiceCatalogStageFixtures";
import { playableMp3Body, playableMp3Bytes } from "./voicePreviewTestAudio";

describe("ElevenLabs voice preview provider", () => {
  it("refetches exact metadata and returns only binary plus hashed provider evidence", async () => {
    const rawVoice = defaultCatalogVoice();
    const catalog = await successfulCatalogProvider({ voices: [rawVoice] }).fetchCatalog(
      voiceCatalogRequest(),
    );
    const client = fakeCatalogClient({ voices: [rawVoice] });
    const provider = new ElevenLabsVoicePreviewProvider({
      readApiKey: () => "server-only-key",
      createClient: () => client,
      fetcher: fetchResponse(
        new Response(playableMp3Body(), { headers: { "request-id": "preview-download-request" } }),
      ),
    });

    const result = await provider.fetchPreview({
      candidate: catalog.candidates[0],
      languageCode: "tr",
      modelId: "eleven_v3",
      subscription: subscriptionFrom(catalog),
    });

    expect(result).toMatchObject({
      format: "mp3",
      sourceClass: "eleven-public-prod",
      voiceMetadataDigest: catalog.candidates[0].metadataDigest,
      sourceUrlSha256: catalog.candidates[0].preview.urlSha256,
    });
    expect(result.requestIdHashes).toEqual(
      expect.arrayContaining([
        sha256("request-id-secret-voice"),
        sha256("preview-download-request"),
      ]),
    );
    expect(result.audio).toEqual(playableMp3Bytes());
    expect(JSON.stringify(result)).not.toContain("request-id-secret");
    expect(JSON.stringify(result)).not.toContain("https://");
    expect(JSON.stringify(result)).not.toContain("server-only-key");
  });

  it("fails closed when provider metadata changes after catalog generation", async () => {
    const rawVoice = defaultCatalogVoice();
    const catalog = await successfulCatalogProvider({ voices: [rawVoice] }).fetchCatalog(
      voiceCatalogRequest(),
    );
    const changedVoice = { ...rawVoice, name: "Changed after catalog" };
    const provider = new ElevenLabsVoicePreviewProvider({
      readApiKey: () => "configured-key",
      createClient: () => fakeCatalogClient({ voices: [changedVoice] }),
      fetcher: fetchResponse(new Response(playableMp3Body())),
    });

    await expect(
      provider.fetchPreview({
        candidate: catalog.candidates[0],
        languageCode: "tr",
        modelId: "eleven_v3",
        subscription: subscriptionFrom(catalog),
      }),
    ).rejects.toThrow("metadata changed");
  });

  it("redacts unexpected download failures", async () => {
    const rawVoice = defaultCatalogVoice();
    const catalog = await successfulCatalogProvider({ voices: [rawVoice] }).fetchCatalog(
      voiceCatalogRequest(),
    );
    const provider = new ElevenLabsVoicePreviewProvider({
      readApiKey: () => "configured-key",
      createClient: () => fakeCatalogClient({ voices: [rawVoice] }),
      fetcher: (async () => {
        throw new Error("signed-url-secret");
      }) as typeof fetch,
    });

    const error = await provider
      .fetchPreview({
        candidate: catalog.candidates[0],
        languageCode: "tr",
        modelId: "eleven_v3",
        subscription: subscriptionFrom(catalog),
      })
      .catch((value: unknown) => value);
    expect((error as Error).message).toBe("ElevenLabs voice preview request failed safely.");
    expect((error as Error).message).not.toContain("signed-url-secret");
  });
});

function subscriptionFrom(
  catalog: Awaited<ReturnType<ReturnType<typeof successfulCatalogProvider>["fetchCatalog"]>>,
) {
  return {
    tier: catalog.subscription.tier,
    status: catalog.subscription.status,
    hasOpenInvoices: catalog.subscription.hasOpenInvoices,
  };
}

function fetchResponse(response: Response): typeof fetch {
  return (async () => response) as typeof fetch;
}
