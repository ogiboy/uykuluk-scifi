import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { z } from "zod";
import { SafeExitError } from "../../../core/errors.js";
import { usdToMicros } from "../../../costs/money.js";
import { type ReservedProviderAdapter } from "../../../costs/reservedProviderExecution.js";
import { normalizePcm16WavPeak, readWavInfo } from "../voiceWav.js";
import type {
  TtsCharacterAlignment,
  TtsSynthesisInput,
  TtsSynthesisResult,
} from "./ttsProvider.js";

const wavOutputFormatSchema = z.enum([
  "wav_16000",
  "wav_22050",
  "wav_24000",
  "wav_32000",
  "wav_44100",
  "wav_48000",
]);

const characterAlignmentSchema = z
  .strictObject({
    characters: z.array(z.string()),
    characterStartTimesSeconds: z.array(z.number().nonnegative()),
    characterEndTimesSeconds: z.array(z.number().nonnegative()),
  })
  .superRefine((alignment, context) => {
    const lengths = [
      alignment.characters.length,
      alignment.characterStartTimesSeconds.length,
      alignment.characterEndTimesSeconds.length,
    ];
    if (new Set(lengths).size !== 1 || lengths[0] === 0) {
      context.addIssue({
        code: "custom",
        message: "ElevenLabs alignment arrays must be non-empty and have equal lengths.",
      });
    }
  });

export type ElevenLabsWavOutputFormat = z.infer<typeof wavOutputFormatSchema>;

export type ElevenLabsTtsProviderConfig = {
  voiceId: string;
  modelId: string;
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

type TimingResponse = {
  audioBase64: string;
  alignment?: TtsCharacterAlignment;
  normalizedAlignment?: TtsCharacterAlignment;
};

type TimingClient = {
  convertWithTimestamps(input: {
    voiceId: string;
    text: string;
    modelId: string;
    outputFormat: ElevenLabsWavOutputFormat;
    voiceSettings?: ElevenLabsTtsProviderConfig["voiceSettings"];
    signal: AbortSignal;
    timeoutMs: number;
    maxRetries: number;
  }): Promise<TimingResponse>;
};

type ElevenLabsTtsProviderOptions = {
  readApiKey?: () => string | undefined;
  createClient?: (apiKey: string) => TimingClient;
};

/** Approval-reserved ElevenLabs adapter. It never exposes or persists the API key. */
export class ElevenLabsTtsProvider {
  readonly mode = "elevenlabs" as const;

  private readonly readApiKey: () => string | undefined;
  private readonly createClient: (apiKey: string) => TimingClient;

  constructor(
    private readonly config: ElevenLabsTtsProviderConfig,
    options: ElevenLabsTtsProviderOptions = {},
  ) {
    this.readApiKey = options.readApiKey ?? (() => process.env.ELEVENLABS_API_KEY);
    this.createClient = options.createClient ?? createOfficialClient;
  }

  /** Fails before cost reservation when credentials or provider configuration are unsafe. */
  assertReady(): void {
    if (!this.config.voiceId.trim()) {
      throw new SafeExitError("ElevenLabs TTS requires a configured voice id.");
    }
    if (!this.config.modelId.trim()) {
      throw new SafeExitError("ElevenLabs TTS requires a configured model id.");
    }
    wavOutputFormatSchema.parse(this.config.outputFormat);
    if (!this.readApiKey()?.trim()) {
      throw new SafeExitError(
        "ElevenLabs TTS requires ELEVENLABS_API_KEY in the server environment.",
      );
    }
  }

  estimateUsd(text: string): number {
    return estimateElevenLabsTtsUsd(text, this.config.usdPerThousandCharacters);
  }

  createReservedAdapter(input: TtsSynthesisInput): ReservedProviderAdapter<TtsSynthesisResult> {
    const estimatedUsdMicros = usdToMicros(this.estimateUsd(input.text));
    return {
      provider: "elevenlabs",
      model: this.config.modelId,
      execute: async (context) => {
        const apiKey = this.readApiKey()?.trim();
        if (!apiKey || estimatedUsdMicros > context.maxUsdMicros) {
          return { kind: "definitely-not-sent", reason: "adapter-validation" };
        }
        try {
          const response = await this.createClient(apiKey).convertWithTimestamps({
            voiceId: this.config.voiceId,
            text: input.text,
            modelId: this.config.modelId,
            outputFormat: this.config.outputFormat,
            voiceSettings: this.config.voiceSettings,
            signal: context.signal,
            timeoutMs: this.config.timeoutMs,
            maxRetries: this.config.maxRetries,
          });
          const alignment = parseAlignment(response.normalizedAlignment ?? response.alignment);
          const sourceBuffer = Buffer.from(response.audioBase64, "base64");
          const normalized = normalizePcm16WavPeak(sourceBuffer);
          const wav = readWavInfo(normalized.buffer);
          return {
            kind: "success",
            value: {
              buffer: normalized.buffer,
              alignment,
              channels: wav.channels,
              durationSeconds: wav.durationSeconds,
              outputAlreadyPersisted: false,
              provider: {
                service: "elevenlabs",
                modelId: this.config.modelId,
                voiceId: this.config.voiceId,
                outputFormat: this.config.outputFormat,
              },
              processing: { peakNormalization: normalized.evidence },
              quality: "elevenlabs",
              sampleRateHz: wav.sampleRateHz,
            },
            actualUsdMicros: estimatedUsdMicros,
          };
        } catch {
          return { kind: "unknown", reason: context.signal.aborted ? "timeout" : "provider-error" };
        }
      },
    };
  }
}

export function estimateElevenLabsTtsUsd(text: string, usdPerThousandCharacters: number): number {
  if (!Number.isFinite(usdPerThousandCharacters) || usdPerThousandCharacters <= 0) {
    throw new SafeExitError("ElevenLabs TTS character pricing must be a positive USD amount.");
  }
  return usdToMicros((text.length / 1_000) * usdPerThousandCharacters) / 1_000_000;
}

function parseAlignment(alignment: TtsCharacterAlignment | undefined): TtsCharacterAlignment {
  if (!alignment) {
    throw new SafeExitError("ElevenLabs TTS response did not include character alignment.");
  }
  return characterAlignmentSchema.parse(alignment);
}

function createOfficialClient(apiKey: string): TimingClient {
  const client = new ElevenLabsClient({ apiKey });
  return {
    async convertWithTimestamps(input): Promise<TimingResponse> {
      return client.textToSpeech.convertWithTimestamps(
        input.voiceId,
        {
          text: input.text,
          modelId: input.modelId,
          outputFormat: input.outputFormat,
          voiceSettings: input.voiceSettings,
        },
        {
          abortSignal: input.signal,
          timeoutInSeconds: input.timeoutMs / 1_000,
          maxRetries: input.maxRetries,
        },
      );
    },
  };
}
