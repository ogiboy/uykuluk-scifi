import { SafeExitError } from "../../../core/errors.js";
import { estimateElevenLabsTtsUsd } from "../../../costs/elevenLabsPricing.js";
import { usdToMicros } from "../../../costs/money.js";
import { type ReservedProviderAdapter } from "../../../costs/reservedProviderExecution.js";
import {
  elevenLabsContextText,
  parseElevenLabsAlignment,
  stitchElevenLabsAlignments,
} from "../elevenLabsAlignment.js";
import { splitElevenLabsText } from "../elevenLabsTextChunks.js";
import { concatenatePcm16Wavs, normalizePcm16WavPeak, readWavInfo } from "../voiceWav.js";
import { createOfficialElevenLabsTimingClient } from "./elevenLabsTimingClient.js";
import {
  wavOutputFormatSchema,
  type ElevenLabsTimingClient,
  type ElevenLabsTtsProviderConfig,
} from "./elevenLabsTtsContracts.js";
import type {
  ReservedTtsProvider,
  TtsCharacterAlignment,
  TtsSynthesisInput,
  TtsSynthesisResult,
} from "./ttsProvider.js";

export type {
  ElevenLabsTtsProviderConfig,
  ElevenLabsWavOutputFormat,
} from "./elevenLabsTtsContracts.js";

type ElevenLabsTtsProviderOptions = {
  readApiKey?: () => string | undefined;
  createClient?: (apiKey: string) => ElevenLabsTimingClient;
};

/** Approval-reserved ElevenLabs adapter. It never exposes or persists the API key. */
export class ElevenLabsTtsProvider implements ReservedTtsProvider {
  readonly mode = "elevenlabs" as const;
  readonly executionPolicy = "reserved-paid" as const;

  private readonly readApiKey: () => string | undefined;
  private readonly createClient: (apiKey: string) => ElevenLabsTimingClient;

  constructor(
    private readonly config: ElevenLabsTtsProviderConfig,
    options: ElevenLabsTtsProviderOptions = {},
  ) {
    this.readApiKey = options.readApiKey ?? (() => process.env.ELEVENLABS_API_KEY);
    this.createClient = options.createClient ?? createOfficialElevenLabsTimingClient;
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
                requestIds.length === 0
                  ? elevenLabsContextText(chunks[index - 1], "end")
                  : undefined,
              nextText: elevenLabsContextText(chunks[index + 1], "start"),
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
              parseElevenLabsAlignment(
                response.normalizedAlignment ?? response.alignment,
                chunkWav.durationSeconds,
              ),
            );
            characterCost += response.characterCost ?? 0;
            if (response.requestId) requestIds.push(response.requestId);
          }
          const stitched = concatenatePcm16Wavs(audioChunks);
          const alignment = stitchElevenLabsAlignments(alignments, audioChunks);
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
