import type { ReservedProviderAdapter } from "../../../costs/reservedProviderExecution.js";

export type TtsMode = "deterministic-local" | "local-piper" | "elevenlabs";

export type TtsQuality = "deterministic-local-reference" | "local-piper" | "elevenlabs";

export type TtsCharacterAlignment = {
  characters: string[];
  characterStartTimesSeconds: number[];
  characterEndTimesSeconds: number[];
};

export type TtsProviderEvidence = {
  binary?: string;
  modelPath?: string;
  modelSha256?: string;
  configPath?: string;
  configSha256?: string;
  service?: "elevenlabs";
  modelId?: string;
  voiceId?: string;
  outputFormat?: string;
};

export type TtsSynthesisInput = { runId: string; text: string };

export type TtsSynthesisResult = {
  buffer: Buffer;
  alignment?: TtsCharacterAlignment;
  normalizedAlignment?: TtsCharacterAlignment;
  channels: number;
  durationSeconds: number;
  outputAlreadyPersisted: boolean;
  provider?: TtsProviderEvidence;
  providerBilling?: {
    source: "provider-reported-credits-approved-tariff-derived-usd";
    billableCredits: number;
    baseUsdPerThousandBillableCredits: number;
    derivedUsdMicros: number;
  };
  providerRequests?: Array<{
    chunkIndex: number;
    textDigest: string;
    requestIdHash?: string;
    reportedBillableCredits: number;
  }>;
  processing?: {
    peakNormalization: {
      applied: boolean;
      gainDb: number;
      sourcePeakDbfs: number;
      targetPeakDbfs: number;
    };
  };
  quality: TtsQuality;
  sampleRateHz: number;
};

/** Synthesizes one voiceover without a paid-provider reservation. */
export interface LocalTtsProvider {
  readonly mode: TtsMode;
  readonly executionPolicy: "local";
  synthesize(input: TtsSynthesisInput): Promise<TtsSynthesisResult>;
}

/** Exposes a paid TTS call only through the exact reservation execution boundary. */
export interface ReservedTtsProvider {
  readonly mode: TtsMode;
  readonly executionPolicy: "reserved-paid";
  assertReady(): void;
  createReservedAdapter(input: TtsSynthesisInput): ReservedProviderAdapter<TtsSynthesisResult>;
}

export type TtsProvider = LocalTtsProvider | ReservedTtsProvider;
