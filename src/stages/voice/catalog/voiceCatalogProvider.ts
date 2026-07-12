import type { VoiceCatalogProviderResult } from "./voiceCatalogContracts.js";

export type VoiceCatalogRequest = {
  languageCode: "tr";
  maxCandidates: number;
  maxCharactersPerRequest: number;
  modelId: string;
  usdPerThousandCharacters: number;
};

export interface VoiceCatalogProvider {
  readonly provider: "elevenlabs";
  assertReady(): void;
  fetchCatalog(input: VoiceCatalogRequest): Promise<VoiceCatalogProviderResult>;
}

export type CatalogReadResult<T> = { data: T; requestId?: string };

export type CatalogVoicePage = { voices: CatalogVoice[]; hasMore: boolean; nextPageToken?: string };

export type CatalogVoice = {
  voiceId: string;
  name?: string;
  category?: string;
  description?: string;
  labels?: Record<string, string>;
  availableForTiers?: string[];
  highQualityBaseModelIds?: string[];
  verifiedLanguages?: Array<{
    language: string;
    modelId: string;
    accent?: string;
    locale?: string;
    previewUrl?: string;
  }>;
  previewUrl?: string;
  isOwner?: boolean;
  isLegacy?: boolean;
  isMixed?: boolean;
  recordingQuality?: string;
  sharing?: {
    status?: string;
    freeUsersAllowed?: boolean;
    liveModerationEnabled?: boolean;
    rate?: number;
    fiatRate?: number;
    noticePeriod?: number;
    disableAtUnix?: number;
    enabledInLibrary?: boolean;
  };
};

export type CatalogModel = {
  modelId: string;
  name?: string;
  canDoTextToSpeech?: boolean;
  canUseStyle?: boolean;
  canUseSpeakerBoost?: boolean;
  maximumTextLengthPerRequest?: number;
  maxCharactersRequestFreeUser?: number;
  maxCharactersRequestSubscribedUser?: number;
  languages?: Array<{ languageId: string }>;
  modelRates?: { characterCostMultiplier: number; costDiscountMultiplier?: number };
  concurrencyGroup?: string;
};

export type CatalogSubscription = {
  tier: string;
  status: string;
  characterCount: number;
  characterLimit: number;
  currency?: string;
  hasOpenInvoices: boolean;
};

export interface ElevenLabsCatalogClient {
  searchVoices(input: {
    nextPageToken?: string;
    pageSize: number;
  }): Promise<CatalogReadResult<CatalogVoicePage>>;
  listModels(): Promise<CatalogReadResult<CatalogModel[]>>;
  getSubscription(): Promise<CatalogReadResult<CatalogSubscription>>;
}
