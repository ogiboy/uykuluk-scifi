import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { loadConfig } from "../src/config/config";
import { artifactPath } from "../src/core/artifacts";
import { buildSelectedVoiceExecutionBinding } from "../src/stages/voice/voiceExecutionBinding";
import type { VoiceExecutionMetadataProvider } from "../src/stages/voice/voiceExecutionPreflight";
import { revalidateSelectedVoiceExecutionBinding } from "../src/stages/voice/voiceExecutionPreflight";
import { useTempProject } from "./helpers";
import { preparePaidVoiceSelection } from "./voiceAuditionStageFixtures";
import {
  defaultCatalogVoice,
  successfulExecutionMetadataProvider,
} from "./voiceCatalogStageFixtures";

describe("selected voice execution preflight", () => {
  useTempProject();

  it("accepts harmless usage drift and records a redacted live receipt", async () => {
    const binding = await prepareBinding();
    const provider = liveProvider({
      subscription: paidSubscription({ characterCount: binding.subscription.characterCount + 100 }),
    });

    const receipt = await revalidateSelectedVoiceExecutionBinding({ binding, provider });

    expect(receipt).toMatchObject({
      provider: "elevenlabs",
      bindingDigest: binding.bindingDigest,
      voiceMetadataDigest: binding.voice.metadataDigest,
      modelMetadataDigest: binding.model.metadataDigest,
      pricingDigest: binding.pricing.digest,
      subscription: {
        characterCount: binding.subscription.characterCount + 100,
        characterLimit: binding.subscription.characterLimit,
        remainingCharacters: expect.any(Number),
        digest: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
      validationDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });

  it("blocks selected voice metadata drift before a reservation can be created", async () => {
    const binding = await prepareBinding();
    const provider = liveProvider({
      subscription: paidSubscription(),
      voices: [defaultCatalogVoice({ name: "Changed Voice Metadata" })],
    });

    await expect(revalidateSelectedVoiceExecutionBinding({ binding, provider })).rejects.toThrow(
      /voice.*metadata|selection.*stale/i,
    );
  });

  it("blocks live model capability drift after approval", async () => {
    const binding = await prepareBinding();
    const provider = liveProvider({
      models: [
        {
          modelId: "eleven_v3",
          canDoTextToSpeech: true,
          canUseStyle: false,
          canUseSpeakerBoost: false,
          maximumTextLengthPerRequest: 5_000,
          maxCharactersRequestFreeUser: 5_000,
          maxCharactersRequestSubscribedUser: 5_000,
          languages: [{ languageId: "tr" }],
          modelRates: { characterCostMultiplier: 1, costDiscountMultiplier: 1 },
        },
      ],
      subscription: paidSubscription(),
    });

    await expect(revalidateSelectedVoiceExecutionBinding({ binding, provider })).rejects.toThrow(
      /model.*metadata|model.*changed/i,
    );
  });

  it("blocks live pricing multiplier drift after approval", async () => {
    const binding = await prepareBinding();
    const provider = liveProvider({
      models: [
        {
          modelId: "eleven_v3",
          canDoTextToSpeech: true,
          canUseStyle: true,
          canUseSpeakerBoost: false,
          maximumTextLengthPerRequest: 5_000,
          maxCharactersRequestFreeUser: 5_000,
          maxCharactersRequestSubscribedUser: 5_000,
          languages: [{ languageId: "tr" }],
          modelRates: { characterCostMultiplier: 1.1, costDiscountMultiplier: 1 },
        },
      ],
      subscription: paidSubscription(),
    });

    await expect(revalidateSelectedVoiceExecutionBinding({ binding, provider })).rejects.toThrow(
      /pricing.*changed|pricing.*metadata/i,
    );
  });

  it("blocks a live tier change before paid synthesis", async () => {
    const binding = await prepareBinding();
    const provider = liveProvider({ subscription: paidSubscription({ tier: "starter" }) });

    await expect(revalidateSelectedVoiceExecutionBinding({ binding, provider })).rejects.toThrow(
      /subscription.*changed|tier/i,
    );
  });

  it("blocks when current remaining quota cannot cover the bound prepared text", async () => {
    const binding = await prepareBinding();
    const provider = liveProvider({
      subscription: paidSubscription({
        characterCount: binding.subscription.characterLimit - binding.input.characterCount + 1,
      }),
    });

    await expect(revalidateSelectedVoiceExecutionBinding({ binding, provider })).rejects.toThrow(
      /quota|remaining.*character/i,
    );
  });
});

async function prepareBinding() {
  const { runId } = await preparePaidVoiceSelection();
  return buildSelectedVoiceExecutionBinding({
    runId,
    config: await loadConfig(),
    preparedText: await readFile(artifactPath(runId, "production/voiceover.txt"), "utf8"),
  });
}

function liveProvider(
  overrides: Parameters<typeof successfulExecutionMetadataProvider>[0],
): VoiceExecutionMetadataProvider {
  return successfulExecutionMetadataProvider(overrides);
}

function paidSubscription(overrides: Record<string, unknown> = {}) {
  return {
    tier: "creator",
    status: "active",
    characterCount: 1_000,
    characterLimit: 100_000,
    hasOpenInvoices: false,
    ...overrides,
  } as {
    tier: string;
    status: string;
    characterCount: number;
    characterLimit: number;
    hasOpenInvoices: boolean;
  };
}
