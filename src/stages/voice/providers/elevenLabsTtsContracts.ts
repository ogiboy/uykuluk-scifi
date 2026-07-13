import { z } from "zod";
import type { TtsCharacterAlignment } from "./ttsProvider.js";

export const wavOutputFormatSchema = z.enum([
  "wav_16000",
  "wav_22050",
  "wav_24000",
  "wav_32000",
  "wav_44100",
  "wav_48000",
]);

export type ElevenLabsWavOutputFormat = z.infer<typeof wavOutputFormatSchema>;

export const elevenLabsBillingEvidenceSchema = z.strictObject({
  source: z.literal("provider-reported-credits-approved-tariff-derived-usd"),
  billableCredits: z.number().nonnegative(),
  baseUsdPerThousandBillableCredits: z.number().positive(),
  derivedUsdMicros: z.int().nonnegative(),
});

export const elevenLabsRequestEvidenceSchema = z.strictObject({
  chunkIndex: z.int().nonnegative(),
  textDigest: z.string().regex(/^[a-f0-9]{64}$/),
  requestIdHash: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  reportedBillableCredits: z.number().nonnegative(),
});

export type ElevenLabsBillingEvidence = z.infer<typeof elevenLabsBillingEvidenceSchema>;

export type ElevenLabsTtsProviderConfig = {
  bindingDigest: string;
  voiceId: string;
  modelId: string;
  languageCode: "tr";
  applyTextNormalization: "auto" | "on" | "off";
  seed: number;
  maxCharactersPerRequest: number;
  outputFormat: ElevenLabsWavOutputFormat;
  timeoutMs: number;
  maxRetries: number;
  maximumUsdPerThousandCharacters: number;
  billedCreditUsdPerThousandCharacters: number;
  voiceSettings?: {
    stability?: number;
    similarityBoost?: number;
    style?: number;
    useSpeakerBoost?: boolean;
    speed?: number;
  };
};

export type ElevenLabsTimingResponse = {
  audioBase64: string;
  alignment?: TtsCharacterAlignment;
  normalizedAlignment?: TtsCharacterAlignment;
  characterCost?: number;
  requestId?: string;
};

export type ElevenLabsTimingClient = {
  convertWithTimestamps(input: {
    voiceId: string;
    text: string;
    modelId: string;
    languageCode: "tr";
    applyTextNormalization: "auto" | "on" | "off";
    seed: number;
    previousRequestIds?: string[];
    previousText?: string;
    nextText?: string;
    outputFormat: ElevenLabsWavOutputFormat;
    voiceSettings: ElevenLabsTtsProviderConfig["voiceSettings"];
    signal: AbortSignal;
    timeoutMs: number;
    maxRetries: number;
  }): Promise<ElevenLabsTimingResponse>;
};
