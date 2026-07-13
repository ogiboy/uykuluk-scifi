import { ElevenLabsError, ElevenLabsTimeoutError } from "@elevenlabs/elevenlabs-js";
import { describe, expect, it } from "vitest";
import {
  VoiceCatalogProviderError,
  type ElevenLabsCatalogClient,
} from "../src/stages/voice/catalog/voiceCatalogProvider";
import { ElevenLabsVoiceCatalogProvider } from "../src/stages/voice/providers/elevenLabsVoiceCatalogProvider";
import { sha256 } from "../src/utils/hash";
import {
  catalogModel,
  catalogSubscription,
  catalogVoice,
  fakeCatalogClient,
  voiceCatalogRequest,
} from "./elevenLabsVoiceCatalogFixtures";

describe("ElevenLabs voice catalog safety", () => {
  it("requires Turkish verification for the exact requested model and ranks it first", async () => {
    const provider = providerWith(
      fakeCatalogClient({
        subscription: catalogSubscription({ tier: "creator" }),
        voices: [
          catalogVoice({
            voiceId: "voice_v2_only",
            name: "A v2",
            verifiedLanguages: [verified("eleven_multilingual_v2", "v2.mp3")],
          }),
          catalogVoice({
            voiceId: "voice_v3_exact",
            name: "Z v3",
            verifiedLanguages: [verified("eleven_v3", "v3.mp3")],
          }),
        ],
      }),
    );

    const catalog = await provider.fetchCatalog(voiceCatalogRequest());

    expect(catalog.candidates.map((candidate) => candidate.voiceId)).toEqual([
      "voice_v3_exact",
      "voice_v2_only",
    ]);
    expect(catalog.candidates[0].productionEligibility.status).toBe("review-required");
    expect(catalog.candidates[1].productionEligibility.status).toBe("review-required");
  });

  it.each([
    ["api key", "server-secret-key"],
    ["request id", "request-id-secret-model"],
    ["signed URL token", "signed-preview-secret"],
  ])("rejects provider free-form metadata that echoes a known %s", async (_, leaked) => {
    const previewUrl =
      "https://storage.googleapis.com/eleven-public-prod/echo.mp3?token=signed-preview-secret";
    const provider = providerWith(
      fakeCatalogClient({ voices: [catalogVoice({ description: `echo:${leaked}`, previewUrl })] }),
    );

    const error = await provider
      .fetchCatalog(voiceCatalogRequest())
      .catch((value: unknown) => value);

    expect(error).toBeInstanceOf(VoiceCatalogProviderError);
    expect((error as Error).message).toContain("echoed sensitive provider data");
    expect((error as Error).message).not.toContain(leaked);
  });

  it("reads a valid multi-page catalog and rejects conflicting duplicate voice metadata", async () => {
    const validClient = pagedClient([
      [catalogVoice({ voiceId: "voice_page_1" })],
      [catalogVoice({ voiceId: "voice_page_2" })],
    ]);
    const valid = await providerWith(validClient).fetchCatalog(voiceCatalogRequest());
    expect(valid.sourceVoiceCount).toBe(2);

    const conflicting = pagedClient([
      [catalogVoice({ voiceId: "voice_duplicate" })],
      [
        catalogVoice({
          voiceId: "voice_duplicate",
          sharing: { liveModerationEnabled: true, rate: 2 },
        }),
      ],
    ]);
    await expect(providerWith(conflicting).fetchCatalog(voiceCatalogRequest())).rejects.toThrow(
      "conflicting metadata",
    );
  });

  it("rejects provider candidates containing terminal control characters", async () => {
    const provider = providerWith(
      fakeCatalogClient({ voices: [catalogVoice({ name: "Unsafe\u001b[31m Voice" })] }),
    );

    const catalog = await provider.fetchCatalog(voiceCatalogRequest());

    expect(catalog.sourceVoiceCount).toBe(1);
    expect(catalog.rejectedVoiceCount).toBe(1);
    expect(catalog.candidates).toEqual([]);
  });

  it("enforces pagination and operation bounds", async () => {
    let calls = 0;
    const endless = fakeCatalogClient();
    endless.searchVoices = async () => {
      calls += 1;
      return { data: { voices: [], hasMore: true, nextPageToken: `page-${calls}` } };
    };
    await expect(providerWith(endless).fetchCatalog(voiceCatalogRequest())).rejects.toThrow(
      "bounded pagination limit",
    );
    expect(calls).toBe(5);

    const hanging = fakeCatalogClient();
    hanging.listModels = async ({ abortSignal } = {}) =>
      new Promise((_, reject) => {
        abortSignal?.addEventListener("abort", () => reject(new Error("abort won")), {
          once: true,
        });
      });
    const deadlineProvider = providerWith(hanging, 10);
    await expect(deadlineProvider.fetchCatalog(voiceCatalogRequest())).rejects.toThrow(
      "bounded deadline",
    );
  });

  it("blocks unusable account state and tier-specific request limits", async () => {
    const unavailableAccount = providerWith(
      fakeCatalogClient({
        subscription: catalogSubscription({
          tier: "creator",
          status: "past_due",
          hasOpenInvoices: true,
        }),
        voices: [catalogVoice()],
      }),
    );
    const catalog = await unavailableAccount.fetchCatalog(voiceCatalogRequest());
    expect(catalog.candidates[0].productionEligibility.status).toBe("blocked");

    const tierLimited = providerWith(
      fakeCatalogClient({ models: [catalogModel({ maxCharactersRequestFreeUser: 4_000 })] }),
    );
    await expect(tierLimited.fetchCatalog(voiceCatalogRequest())).rejects.toThrow(
      "subscription limit",
    );
  });

  it.each([
    [401, "configuration"],
    [403, "configuration"],
    [400, "provider-response-invalid"],
    [404, "provider-response-invalid"],
    [409, "provider-response-invalid"],
    [422, "provider-response-invalid"],
    [408, "provider-unavailable"],
    [425, "provider-unavailable"],
    [429, "provider-unavailable"],
    [500, "provider-unavailable"],
    [503, "provider-unavailable"],
  ] as const)("classifies status %s without persisting SDK body text", async (status, code) => {
    const client = fakeCatalogClient();
    client.listModels = async () => {
      throw new ElevenLabsError({
        statusCode: status,
        body: { detail: "sdk-body-secret-must-not-leak" },
      });
    };

    const error = await providerWith(client)
      .fetchCatalog(voiceCatalogRequest())
      .catch((value: unknown) => value);

    expect(error).toBeInstanceOf(VoiceCatalogProviderError);
    expect((error as VoiceCatalogProviderError).providerCode).toBe(code);
    expect((error as Error).message).not.toContain("sdk-body-secret");
  });

  it("classifies SDK timeouts as a redacted provider outage", async () => {
    const client = fakeCatalogClient();
    client.listModels = async () => {
      throw new ElevenLabsTimeoutError("timeout-secret");
    };
    const error = await providerWith(client)
      .fetchCatalog(voiceCatalogRequest())
      .catch((value: unknown) => value);
    expect(error).toBeInstanceOf(VoiceCatalogProviderError);
    expect((error as VoiceCatalogProviderError).providerCode).toBe("provider-unavailable");
    expect((error as Error).message).not.toContain("timeout-secret");
  });

  it("retains only hashed partial request evidence when a later catalog call fails", async () => {
    const client = fakeCatalogClient();
    client.getSubscription = async () => {
      throw new ElevenLabsTimeoutError("subscription-timeout-secret");
    };

    const error = await providerWith(client)
      .fetchCatalog(voiceCatalogRequest())
      .catch((value: unknown) => value);

    expect(error).toBeInstanceOf(VoiceCatalogProviderError);
    expect((error as VoiceCatalogProviderError).requestIdHashes).toEqual([
      sha256("request-id-secret-model"),
    ]);
    expect(JSON.stringify(error)).not.toContain("request-id-secret-model");
  });
});

function providerWith(client: ElevenLabsCatalogClient, operationTimeoutMs = 1_000) {
  return new ElevenLabsVoiceCatalogProvider({
    readApiKey: () => "server-secret-key",
    createClient: () => client,
    operationTimeoutMs,
  });
}

function verified(modelId: string, filename: string) {
  return {
    language: "tr",
    modelId,
    previewUrl: `https://storage.googleapis.com/eleven-public-prod/${filename}`,
  };
}

function pagedClient(pages: ReturnType<typeof catalogVoice>[][]): ElevenLabsCatalogClient {
  const client = fakeCatalogClient();
  client.searchVoices = async ({ nextPageToken }) => {
    const index = nextPageToken ? Number(nextPageToken) : 0;
    const next = index + 1;
    return {
      data: {
        voices: pages[index] ?? [],
        hasMore: next < pages.length,
        nextPageToken: next < pages.length ? String(next) : undefined,
      },
      requestId: `page-request-${index}`,
    };
  };
  return client;
}
