import { SafeExitError } from "../../../core/errors.js";
import type { VoiceCandidate, VoiceCatalogProviderResult } from "./voiceCatalogContracts.js";

export type VoiceCatalogProviderErrorCode =
  "configuration" | "provider-unavailable" | "provider-response-invalid";

export class VoiceCatalogProviderError extends SafeExitError {
  readonly providerCode: VoiceCatalogProviderErrorCode;
  readonly requestIdHashes: string[];

  constructor(
    message: string,
    code: VoiceCatalogProviderErrorCode,
    requestIdHashes: string[] = [],
  ) {
    super(message);
    this.name = "VoiceCatalogProviderError";
    this.providerCode = code;
    this.requestIdHashes = requestIdHashes.slice(0, 16);
  }
}

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

export type VoicePreviewProviderResult = {
  audio: Buffer;
  format: "mp3" | "wav";
  fetchedAt: string;
  requestIdHashes: string[];
  sourceClass: "elevenlabs" | "eleven-public-prod";
  sourceUrlSha256: string;
  voiceMetadataDigest: string;
};

export interface VoicePreviewProvider {
  readonly provider: "elevenlabs";
  assertReady(): void;
  fetchPreview(input: {
    candidate: VoiceCandidate;
    languageCode: "tr";
    modelId: string;
    subscription: { tier: string; status: string; hasOpenInvoices: boolean };
  }): Promise<VoicePreviewProviderResult>;
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
  maxCreditLimitExtension?: number | "unlimited";
  canExtendCharacterLimit?: boolean;
  currentOverage?: { amount: string; currency: string };
  nextCharacterCountResetUnix?: number;
};

export interface ElevenLabsCatalogClient {
  searchVoices(input: {
    abortSignal?: AbortSignal;
    nextPageToken?: string;
    pageSize: number;
  }): Promise<CatalogReadResult<CatalogVoicePage>>;
  listModels(input?: { abortSignal?: AbortSignal }): Promise<CatalogReadResult<CatalogModel[]>>;
  getSubscription(input?: {
    abortSignal?: AbortSignal;
  }): Promise<CatalogReadResult<CatalogSubscription>>;
  getVoice(
    voiceId: string,
    input?: { abortSignal?: AbortSignal },
  ): Promise<CatalogReadResult<CatalogVoice>>;
}
