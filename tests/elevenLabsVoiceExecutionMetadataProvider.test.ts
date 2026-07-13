import { describe, expect, it, vi } from "vitest";

import { ElevenLabsVoiceExecutionMetadataProvider } from "../src/stages/voice/providers/elevenLabsVoiceExecutionMetadataProvider";
import {
  catalogSubscription,
  catalogVoice,
  fakeCatalogClient,
  voiceCatalogRequest,
} from "./elevenLabsVoiceCatalogFixtures";

describe("ElevenLabs voice execution metadata provider", () => {
  it("uses exact bounded GETs and returns only normalized redacted metadata", async () => {
    const voiceId = "voice_selected_live";
    const rawClient = fakeCatalogClient({
      subscription: catalogSubscription({ tier: "creator", characterCount: 1_250 }),
      voices: [
        catalogVoice({
          voiceId,
          previewUrl: "https://storage.googleapis.com/eleven-public-prod/selected.mp3?token=secret",
          verifiedLanguages: [
            {
              language: "tr",
              modelId: "eleven_v3",
              previewUrl: "https://storage.googleapis.com/eleven-public-prod/selected-tr.mp3",
            },
          ],
        }),
      ],
    });
    const getVoice = vi.fn(rawClient.getVoice);
    const listModels = vi.fn(rawClient.listModels);
    const getSubscription = vi.fn(rawClient.getSubscription);
    const provider = new ElevenLabsVoiceExecutionMetadataProvider({
      readApiKey: () => "secret-live-api-key",
      createClient: () => ({ ...rawClient, getVoice, listModels, getSubscription }),
    });

    const result = await provider.fetchSnapshot({ ...voiceCatalogRequest(), voiceId });

    expect(getVoice).toHaveBeenCalledWith(voiceId, { abortSignal: expect.any(AbortSignal) });
    expect(listModels).toHaveBeenCalledTimes(1);
    expect(getSubscription).toHaveBeenCalledTimes(1);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].voiceId).toBe(voiceId);
    expect(result.requestIdHashes).toEqual(
      expect.arrayContaining([expect.stringMatching(/^[a-f0-9]{64}$/)]),
    );
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("secret-live-api-key");
    expect(serialized).not.toContain("request-id-secret");
    expect(serialized).not.toContain("token=secret");
  });

  it("fails within the outer deadline without exposing provider details", async () => {
    const provider = new ElevenLabsVoiceExecutionMetadataProvider({
      readApiKey: () => "secret-live-api-key",
      operationTimeoutMs: 5,
      createClient: () => ({
        ...fakeCatalogClient(),
        listModels: () => new Promise(() => undefined),
      }),
    });

    await expect(
      provider.fetchSnapshot({ ...voiceCatalogRequest(), voiceId: "voice_timeout" }),
    ).rejects.toThrow(/bounded deadline|exceeded/i);
  });

  it("aborts sibling metadata requests when one parallel GET fails early", async () => {
    let siblingSignal: AbortSignal | undefined;
    const rawClient = fakeCatalogClient();
    const provider = new ElevenLabsVoiceExecutionMetadataProvider({
      readApiKey: () => "secret-live-api-key",
      createClient: () => ({
        ...rawClient,
        listModels: (options) => {
          const abortSignal = options?.abortSignal;
          if (!abortSignal) throw new Error("Expected bounded metadata abort signal.");
          siblingSignal = abortSignal;
          return new Promise((_, reject) => {
            abortSignal.addEventListener("abort", () => reject(abortSignal.reason), { once: true });
          });
        },
        getSubscription: async () => {
          throw new Error("provider peer failed");
        },
      }),
    });

    await expect(
      provider.fetchSnapshot({ ...voiceCatalogRequest(), voiceId: "voice_peer_failure" }),
    ).rejects.toThrow(/metadata refresh failed safely/i);
    expect(siblingSignal?.aborted).toBe(true);
  });
});
