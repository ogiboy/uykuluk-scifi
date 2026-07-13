import type {
  CatalogModel,
  CatalogSubscription,
  CatalogVoice,
  ElevenLabsCatalogClient,
} from "../src/stages/voice/catalog/voiceCatalogProvider";

export function voiceCatalogRequest() {
  return {
    languageCode: "tr" as const,
    maxCandidates: 24,
    maxCharactersPerRequest: 4_500,
    modelId: "eleven_v3",
    usdPerThousandCharacters: 0.1,
  };
}

export function fakeCatalogClient(
  overrides: {
    models?: CatalogModel[];
    subscription?: CatalogSubscription;
    voices?: CatalogVoice[];
  } = {},
): ElevenLabsCatalogClient {
  return {
    async listModels() {
      return { data: overrides.models ?? [catalogModel()], requestId: "request-id-secret-model" };
    },
    async getSubscription() {
      return {
        data: overrides.subscription ?? catalogSubscription(),
        requestId: "request-id-secret-subscription",
      };
    },
    async searchVoices() {
      return {
        data: { voices: overrides.voices ?? [], hasMore: false },
        requestId: "request-id-secret-voices",
      };
    },
    async getVoice(voiceId) {
      return {
        data:
          (overrides.voices ?? []).find((candidate) => candidate.voiceId === voiceId) ??
          catalogVoice({ voiceId }),
        requestId: "request-id-secret-voice",
      };
    },
  };
}

export function catalogVoice(overrides: Partial<CatalogVoice> = {}): CatalogVoice {
  return {
    voiceId: "voice_default",
    name: "Default Voice",
    category: "premade",
    labels: { accent: "neutral" },
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/default.mp3",
    verifiedLanguages: [],
    ...overrides,
  };
}

export function catalogModel(overrides: Partial<CatalogModel> = {}): CatalogModel {
  return {
    modelId: "eleven_v3",
    name: "Eleven v3",
    canDoTextToSpeech: true,
    canUseStyle: true,
    canUseSpeakerBoost: false,
    maximumTextLengthPerRequest: 5_000,
    maxCharactersRequestFreeUser: 5_000,
    maxCharactersRequestSubscribedUser: 5_000,
    languages: [{ languageId: "tr" }, { languageId: "en" }],
    modelRates: { characterCostMultiplier: 1, costDiscountMultiplier: 1 },
    ...overrides,
  };
}

export function catalogSubscription(
  overrides: Partial<CatalogSubscription> = {},
): CatalogSubscription {
  return {
    tier: "free",
    status: "active",
    characterCount: 0,
    characterLimit: 10_000,
    currency: "usd",
    hasOpenInvoices: false,
    ...overrides,
  };
}
