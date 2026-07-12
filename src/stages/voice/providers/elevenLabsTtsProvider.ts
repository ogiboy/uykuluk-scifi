import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { z } from "zod";
import { SafeExitError } from "../../../core/errors.js";
import { estimateElevenLabsTtsUsd } from "../../../costs/elevenLabsPricing.js";
import { usdToMicros } from "../../../costs/money.js";
import { type ReservedProviderAdapter } from "../../../costs/reservedProviderExecution.js";
import { splitElevenLabsText } from "../elevenLabsTextChunks.js";
import { concatenatePcm16Wavs, normalizePcm16WavPeak, readWavInfo } from "../voiceWav.js";
import type {
  ReservedTtsProvider,
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

type TimingResponse = {
  audioBase64: string;
  alignment?: TtsCharacterAlignment;
  normalizedAlignment?: TtsCharacterAlignment;
  characterCost?: number;
  requestId?: string;
};

type TimingClient = {
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
  }): Promise<TimingResponse>;
};

type ElevenLabsTtsProviderOptions = {
  readApiKey?: () => string | undefined;
  createClient?: (apiKey: string) => TimingClient;
};

/** Approval-reserved ElevenLabs adapter. It never exposes or persists the API key. */
export class ElevenLabsTtsProvider implements ReservedTtsProvider {
  readonly mode = "elevenlabs" as const;
  readonly executionPolicy = "reserved-paid" as const;

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
    if (
      this.config.modelId === "eleven_v3" &&
      this.config.voiceSettings?.useSpeakerBoost !== undefined
    ) {
      throw new SafeExitError("Eleven v3 does not support Speaker Boost.");
    }
    if (this.config.maxRetries !== 0) {
      throw new SafeExitError(
        "ElevenLabs TTS retries must remain disabled because the API has no idempotency key.",
      );
    }
    wavOutputFormatSchema.parse(this.config.outputFormat);
    splitElevenLabsText("configuration-check", this.config.maxCharactersPerRequest);
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
        let lastProviderRequestId: string | undefined;
        try {
          const client = this.createClient(apiKey);
          const chunks = splitElevenLabsText(input.text, this.config.maxCharactersPerRequest);
          const audioChunks: Buffer[] = [];
          const alignments: TtsCharacterAlignment[] = [];
          const requestIds: string[] = [];
          let characterCost = 0;
          for (const [index, text] of chunks.entries()) {
            const response = await client.convertWithTimestamps({
              voiceId: this.config.voiceId,
              text,
              modelId: this.config.modelId,
              languageCode: this.config.languageCode,
              applyTextNormalization: this.config.applyTextNormalization,
              seed: (this.config.seed + index) % 4_294_967_296,
              previousRequestIds: requestIds.length > 0 ? requestIds.slice(-3) : undefined,
              previousText:
                requestIds.length === 0 ? contextText(chunks[index - 1], "end") : undefined,
              nextText: contextText(chunks[index + 1], "start"),
              outputFormat: this.config.outputFormat,
              voiceSettings: this.config.voiceSettings,
              signal: context.signal,
              timeoutMs: this.config.timeoutMs,
              maxRetries: this.config.maxRetries,
            });
            lastProviderRequestId = response.requestId ?? lastProviderRequestId;
            if (!Number.isInteger(response.characterCost) || (response.characterCost ?? -1) < 0) {
              return {
                kind: "unknown",
                reason: "indeterminate",
                providerRequestId: response.requestId,
              };
            }
            const sourceBuffer = Buffer.from(response.audioBase64, "base64");
            const chunkWav = readWavInfo(sourceBuffer);
            audioChunks.push(sourceBuffer);
            alignments.push(
              parseAlignment(
                response.normalizedAlignment ?? response.alignment,
                chunkWav.durationSeconds,
              ),
            );
            characterCost += response.characterCost ?? 0;
            if (response.requestId) {
              requestIds.push(response.requestId);
            }
          }
          const stitched = concatenatePcm16Wavs(audioChunks);
          const alignment = stitchAlignments(alignments, audioChunks);
          const normalized = normalizePcm16WavPeak(stitched);
          const wav = readWavInfo(normalized.buffer);
          const actualUsdMicros = usdToMicros(
            (characterCost / 1_000) * this.config.usdPerThousandCharacters,
          );
          if (actualUsdMicros > context.maxUsdMicros) {
            return {
              kind: "unknown",
              reason: "indeterminate",
              providerRequestId: lastProviderRequestId,
            };
          }
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
            actualUsdMicros,
            providerRequestId: requestIds.at(-1),
          };
        } catch {
          return {
            kind: "unknown",
            reason: context.signal.aborted ? "timeout" : "provider-error",
            providerRequestId: lastProviderRequestId,
          };
        }
      },
    };
  }
}

function parseAlignment(
  alignment: TtsCharacterAlignment | undefined,
  durationSeconds: number,
): TtsCharacterAlignment {
  if (!alignment) {
    throw new SafeExitError("ElevenLabs TTS response did not include character alignment.");
  }
  const parsed = characterAlignmentSchema.parse(alignment);
  for (let index = 0; index < parsed.characters.length; index += 1) {
    const start = parsed.characterStartTimesSeconds[index];
    const end = parsed.characterEndTimesSeconds[index];
    if (
      end < start ||
      (index > 0 && start < parsed.characterStartTimesSeconds[index - 1]) ||
      (index > 0 && end < parsed.characterEndTimesSeconds[index - 1])
    ) {
      throw new SafeExitError("ElevenLabs character alignment is not monotonic.");
    }
  }
  if ((parsed.characterEndTimesSeconds.at(-1) ?? 0) > durationSeconds + 0.5) {
    throw new SafeExitError("ElevenLabs character alignment exceeds the returned audio duration.");
  }
  return parsed;
}

function stitchAlignments(
  alignments: readonly TtsCharacterAlignment[],
  audioChunks: readonly Buffer[],
): TtsCharacterAlignment {
  const stitched: TtsCharacterAlignment = {
    characters: [],
    characterStartTimesSeconds: [],
    characterEndTimesSeconds: [],
  };
  let offsetSeconds = 0;
  for (const [index, alignment] of alignments.entries()) {
    stitched.characters.push(...alignment.characters);
    stitched.characterStartTimesSeconds.push(
      ...alignment.characterStartTimesSeconds.map((value) => value + offsetSeconds),
    );
    stitched.characterEndTimesSeconds.push(
      ...alignment.characterEndTimesSeconds.map((value) => value + offsetSeconds),
    );
    offsetSeconds += readWavInfo(audioChunks[index]).durationSeconds;
  }
  return characterAlignmentSchema.parse(stitched);
}

function contextText(value: string | undefined, edge: "start" | "end"): string | undefined {
  if (!value) {
    return undefined;
  }
  const limit = 1_000;
  return edge === "start" ? value.slice(0, limit) : value.slice(-limit);
}

function createOfficialClient(apiKey: string): TimingClient {
  const client = new ElevenLabsClient({ apiKey });
  return {
    async convertWithTimestamps(input): Promise<TimingResponse> {
      const { data, rawResponse } = await client.textToSpeech
        .convertWithTimestamps(
          input.voiceId,
          {
            text: input.text,
            modelId: input.modelId,
            languageCode: input.modelId === "eleven_v3" ? input.languageCode : undefined,
            applyTextNormalization: input.applyTextNormalization,
            seed: input.seed,
            previousRequestIds: input.previousRequestIds,
            previousText: input.previousText,
            nextText: input.nextText,
            outputFormat: input.outputFormat,
            voiceSettings: input.voiceSettings,
          },
          {
            abortSignal: input.signal,
            timeoutInSeconds: input.timeoutMs / 1_000,
            maxRetries: input.maxRetries,
          },
        )
        .withRawResponse();
      return {
        ...data,
        characterCost: parseCharacterCost(rawResponse.headers.get("character-cost")),
        requestId: rawResponse.headers.get("request-id") ?? undefined,
      };
    },
  };
}

function parseCharacterCost(value: string | null): number | undefined {
  if (value === null || !/^\d+$/.test(value)) {
    return undefined;
  }
  return Number(value);
}
