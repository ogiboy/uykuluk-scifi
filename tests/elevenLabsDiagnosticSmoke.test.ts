import { ElevenLabsError } from "@elevenlabs/elevenlabs-js";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultConfig } from "../src/config/config.js";
import type {
  CatalogSubscription,
  ElevenLabsCatalogClient,
} from "../src/stages/voice/catalog/voiceCatalogProvider.js";
import { runElevenLabsDiagnosticSmoke } from "../src/stages/voice/elevenLabsDiagnosticSmoke.js";
import type { ElevenLabsTimingClient } from "../src/stages/voice/providers/elevenLabsTtsContracts.js";
import { wavFromPcm16 } from "../src/stages/voice/voiceWav.js";
import { writeJsonFile } from "../src/utils/json.js";

const operationId = "provider_smoke_20260717235900_abcdef";
const createdRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    createdRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
  );
});

describe("ElevenLabs diagnostic smoke", () => {
  it("persists diagnostic-only audio and redacted evidence after included-credit preflight", async () => {
    const root = await createProject();
    const text = "Merhaba dünya.";
    const audio = wavFromPcm16(Buffer.alloc(24_000 * 2), 24_000, 1);
    const convertWithTimestamps = vi.fn(async () => ({
      audioBase64: audio.toString("base64"),
      alignment: alignmentFor(text),
      normalizedAlignment: alignmentFor(text),
      characterCost: text.length,
      requestId: "request-id-must-be-hashed",
    }));

    const evidence = await runElevenLabsDiagnosticSmoke(
      root,
      { text, voiceId: "voice_test" },
      dependencies(convertWithTimestamps),
    );

    expect(evidence).toMatchObject({
      capability: "text-to-speech-with-timestamps",
      operationId,
      productionEligible: false,
      requestSent: true,
      status: "succeeded",
      usage: "diagnostic-only",
    });
    if (evidence.status !== "succeeded") throw new Error("Expected successful evidence.");
    expect(evidence.providerRequestIdHash).toMatch(/^[a-f0-9]{64}$/);
    expect(evidence.providerRequestIdHash).not.toBe("request-id-must-be-hashed");
    expect(await readFile(path.join(root, evidence.audio.path))).toEqual(audio);
    const persisted = await readFile(evidencePath(root), "utf8");
    expect(persisted).not.toContain("fixture-elevenlabs-key");
    expect(persisted).not.toContain("request-id-must-be-hashed");
    expect(convertWithTimestamps).toHaveBeenCalledOnce();
  });

  it("blocks before synthesis when included credits are insufficient", async () => {
    const root = await createProject();
    const convertWithTimestamps = vi.fn();
    const catalogClient = fakeCatalogClient({ characterCount: 9_999, characterLimit: 10_000 });

    await expect(
      runElevenLabsDiagnosticSmoke(
        root,
        { text: "Bu istek kalan krediden daha uzundur.", voiceId: "voice_test" },
        dependencies(convertWithTimestamps, catalogClient),
      ),
    ).rejects.toThrow(/included-credit entitlement/i);

    expect(convertWithTimestamps).not.toHaveBeenCalled();
    expect(JSON.parse(await readFile(evidencePath(root), "utf8"))).toMatchObject({
      status: "blocked",
      reason: "entitlement",
      requestSent: false,
      productionEligible: false,
    });
  });

  it("blocks before synthesis when usage-based overage is enabled", async () => {
    const root = await createProject();
    const convertWithTimestamps = vi.fn();
    const catalogClient = fakeCatalogClient({
      canExtendCharacterLimit: true,
      maxCreditLimitExtension: "unlimited",
    });

    await expect(
      runElevenLabsDiagnosticSmoke(
        root,
        { text: "Kısa güvenli tanı.", voiceId: "voice_test" },
        dependencies(convertWithTimestamps, catalogClient),
      ),
    ).rejects.toThrow(/included-credit entitlement/i);

    expect(convertWithTimestamps).not.toHaveBeenCalled();
  });

  it("persists only redacted provider rejection diagnostics and never retries", async () => {
    const root = await createProject();
    const convertWithTimestamps = vi.fn(async () => {
      throw new ElevenLabsError({
        message: "sensitive provider detail",
        statusCode: 403,
        body: { detail: "secret response body" },
      });
    });

    await expect(
      runElevenLabsDiagnosticSmoke(
        root,
        { text: "Kısa güvenli tanı.", voiceId: "voice_test" },
        dependencies(convertWithTimestamps),
      ),
    ).rejects.toThrow(/rejected the diagnostic request/i);

    expect(convertWithTimestamps).toHaveBeenCalledOnce();
    expect(convertWithTimestamps).toHaveBeenCalledWith(expect.objectContaining({ maxRetries: 0 }));
    const persisted = await readFile(evidencePath(root), "utf8");
    expect(JSON.parse(persisted)).toMatchObject({
      status: "failed",
      reason: "provider-rejected",
      requestSent: true,
      providerStatusCode: 403,
      providerErrorCategory: "access-denied",
    });
    expect(persisted).not.toContain("sensitive provider detail");
    expect(persisted).not.toContain("secret response body");
    expect(persisted).not.toContain("fixture-elevenlabs-key");
  });
});

async function createProject(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "uykuluk-elevenlabs-smoke-"));
  createdRoots.push(root);
  await writeJsonFile(path.join(root, "producer.config.json"), {
    ...defaultConfig,
    providers: {
      ...defaultConfig.providers,
      tts: {
        ...defaultConfig.providers.tts,
        enabled: true,
        mode: "local-piper",
        elevenLabs: { ...defaultConfig.providers.tts.elevenLabs, modelId: "eleven_v3" },
      },
    },
  });
  return root;
}

function dependencies(
  convertWithTimestamps: ElevenLabsTimingClient["convertWithTimestamps"],
  catalogClient = fakeCatalogClient(),
) {
  return {
    createCatalogClient: () => catalogClient,
    createTimingClient: () => ({ convertWithTimestamps }),
    createOperationId: () => operationId,
    now: () => "2026-07-17T20:59:00.000Z",
    readApiKey: () => "fixture-elevenlabs-key",
  };
}

function fakeCatalogClient(overrides: Partial<CatalogSubscription> = {}): ElevenLabsCatalogClient {
  const subscription: CatalogSubscription = {
    tier: "free",
    status: "free",
    characterCount: 100,
    characterLimit: 10_000,
    maxCreditLimitExtension: 0,
    canExtendCharacterLimit: false,
    currentOverage: { amount: "0", currency: "usd" },
    hasOpenInvoices: false,
    ...overrides,
  };
  return {
    async getSubscription() {
      return { data: subscription, requestId: "subscription-request-id" };
    },
    async listModels() {
      return {
        data: [
          {
            modelId: "eleven_v3",
            canDoTextToSpeech: true,
            maximumTextLengthPerRequest: 5_000,
            maxCharactersRequestFreeUser: 5_000,
            languages: [{ languageId: "tr" }],
            modelRates: { characterCostMultiplier: 1, costDiscountMultiplier: 1 },
          },
        ],
      };
    },
    async searchVoices() {
      return { data: { voices: [], hasMore: false } };
    },
    async getVoice() {
      return { data: { voiceId: "voice_test" } };
    },
  };
}

function alignmentFor(text: string) {
  const characters = [...text];
  return {
    characters,
    characterStartTimesSeconds: characters.map((_, index) => index * 0.01),
    characterEndTimesSeconds: characters.map((_, index) => (index + 1) * 0.01),
  };
}

function evidencePath(root: string): string {
  return path.join(root, "diagnostics", "provider-smokes", "elevenlabs", `${operationId}.json`);
}
