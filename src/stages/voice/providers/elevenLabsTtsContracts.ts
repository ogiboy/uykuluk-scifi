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

export type ElevenLabsTtsProviderConfig = {
  voiceId: string;
  modelId: string;
  languageCode: "tr";
  applyTextNormalization: "auto" | "on" | "off";
  seed: number;
  maxCharactersPerRequest: number;
  outputFormat: ElevenLabsWavOutputFormat;
  timeoutMs: number;
  maxRetries: number;
  usdPerThousandCharacters: number;
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
    voiceSettings?: ElevenLabsTtsProviderConfig["voiceSettings"];
    signal: AbortSignal;
    timeoutMs: number;
    maxRetries: number;
  }): Promise<ElevenLabsTimingResponse>;
};
