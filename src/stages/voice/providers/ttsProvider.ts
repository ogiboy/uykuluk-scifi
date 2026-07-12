export type TtsMode = "deterministic-local" | "local-piper";

export type TtsQuality = "deterministic-local-reference" | "local-piper";

export type TtsProviderEvidence = {
  binary?: string;
  modelPath?: string;
  modelSha256?: string;
  configPath?: string;
  configSha256?: string;
};

export type TtsSynthesisInput = { runId: string; text: string };

export type TtsSynthesisResult = {
  buffer: Buffer;
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
