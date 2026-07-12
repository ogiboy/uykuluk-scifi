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
  channels: number;
  durationSeconds: number;
  outputAlreadyPersisted: boolean;
  provider?: TtsProviderEvidence;
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

/** Synthesizes one voiceover through a configured TTS engine. */
export interface TtsProvider {
  readonly mode: TtsMode;
  synthesize(input: TtsSynthesisInput): Promise<TtsSynthesisResult>;
}
