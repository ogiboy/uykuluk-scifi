import { SafeExitError } from "../../../core/errors.js";
import { estimateElevenLabsTtsUsd } from "../../../costs/elevenLabsPricing.js";
import { usdToMicrosCeil } from "../../../costs/money.js";
import type { ProviderRequestEvidence } from "../../../costs/providerRequestEvidence.js";
import { type ReservedProviderAdapter } from "../../../costs/reservedProviderExecution.js";
import { sha256 } from "../../../utils/hash.js";
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
    if (!/^[a-f0-9]{64}$/.test(this.config.bindingDigest)) {
      throw new SafeExitError("ElevenLabs TTS requires an exact execution binding digest.");
    }
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
    return estimateElevenLabsTtsUsd(text, this.config.maximumUsdPerThousandCharacters);
  }

  createReservedAdapter(input: TtsSynthesisInput): ReservedProviderAdapter<TtsSynthesisResult> {
    const estimatedUsdMicros = usdToMicrosCeil(this.estimateUsd(input.text));
    return {
      provider: "elevenlabs",
      model: this.config.modelId,
      bindingDigest: this.config.bindingDigest,
      execute: async (context) => {
        const apiKey = this.readApiKey()?.trim();
        if (
          !apiKey ||
          estimatedUsdMicros > context.maxUsdMicros ||
          context.bindingDigest !== this.config.bindingDigest
        ) {
          return { kind: "definitely-not-sent", reason: "adapter-validation" };
        }
        let lastProviderRequestId: string | undefined;
        const requestEvidence: ProviderRequestEvidence = [];
        try {
          const client = this.createClient(apiKey);
          const chunks = splitElevenLabsText(input.text, this.config.maxCharactersPerRequest);
          const audioChunks: Buffer[] = [];
          const alignments: TtsCharacterAlignment[] = [];
          const requestIds: string[] = [];
          const requestDiagnostics: NonNullable<TtsSynthesisResult["providerRequests"]> = [];
          let characterCost = 0;
          for (const [index, text] of chunks.entries()) {
            const requestStitching = requestStitchingFor(
              this.config.modelId,
              chunks,
              index,
              requestIds,
            );
            const response = await client.convertWithTimestamps({
              voiceId: this.config.voiceId,
              text,
              modelId: this.config.modelId,
              languageCode: this.config.languageCode,
              applyTextNormalization: this.config.applyTextNormalization,
              seed: (this.config.seed + index) % 4_294_967_296,
              ...requestStitching,
              outputFormat: this.config.outputFormat,
              voiceSettings: this.config.voiceSettings,
              signal: context.signal,
              timeoutMs: this.config.timeoutMs,
              maxRetries: this.config.maxRetries,
            });
            lastProviderRequestId = response.requestId ?? lastProviderRequestId;
            const redactedRequest = {
              requestIndex: index,
              inputDigest: sha256(text),
              ...(response.requestId ? { requestIdHash: sha256(response.requestId) } : {}),
            };
            if (
              typeof response.characterCost !== "number" ||
              !Number.isFinite(response.characterCost) ||
              response.characterCost < 0
            ) {
              return {
                kind: "unknown",
                reason: "indeterminate",
                providerRequestId: response.requestId,
                requestEvidence: [...requestEvidence, redactedRequest],
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
            requestDiagnostics.push({
              chunkIndex: index,
              textDigest: redactedRequest.inputDigest,
              ...(redactedRequest.requestIdHash
                ? { requestIdHash: redactedRequest.requestIdHash }
                : {}),
              reportedBillableCredits: response.characterCost,
            });
            requestEvidence.push({ ...redactedRequest, reportedUnits: response.characterCost });
            if (response.requestId) requestIds.push(response.requestId);
          }
          const stitched = concatenatePcm16Wavs(audioChunks);
          const alignment = stitchElevenLabsAlignments(alignments, audioChunks);
          const normalized = normalizePcm16WavPeak(stitched);
          const wav = readWavInfo(normalized.buffer);
          const actualUsdMicros = usdToMicrosCeil(
            (characterCost / 1_000) * this.config.billedCreditUsdPerThousandCharacters,
          );
          if (actualUsdMicros > context.maxUsdMicros) {
            return {
              kind: "unknown",
              reason: "indeterminate",
              providerRequestId: lastProviderRequestId,
              requestEvidence,
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
              providerBilling: {
                source: "provider-reported-credits-approved-tariff-derived-usd",
                billableCredits: characterCost,
                baseUsdPerThousandBillableCredits: this.config.billedCreditUsdPerThousandCharacters,
                derivedUsdMicros: actualUsdMicros,
              },
              providerRequests: requestDiagnostics,
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
            ...(requestEvidence.length > 0 ? { requestEvidence } : {}),
          };
        }
      },
    };
  }
}

/**
 * Determines the stitching context for an ElevenLabs text chunk request.
 *
 * @param modelId - The ElevenLabs model identifier.
 * @param chunks - The text chunks being processed.
 * @param index - The index of the current chunk.
 * @param requestIds - Request identifiers from previously processed chunks.
 * @returns The previous request IDs and neighboring text context used for stitching.
 */
function requestStitchingFor(
  modelId: string,
  chunks: readonly string[],
  index: number,
  requestIds: readonly string[],
): Pick<
  Parameters<ElevenLabsTimingClient["convertWithTimestamps"]>[0],
  "previousRequestIds" | "previousText" | "nextText"
> {
  if (modelId === "eleven_v3") return {};
  let previousText: string | undefined;
  if (requestIds.length === 0) {
    previousText = elevenLabsContextText(chunks[index - 1], "end");
  }
  return {
    previousRequestIds: requestIds.length > 0 ? requestIds.slice(-3) : undefined,
    previousText,
    nextText: elevenLabsContextText(chunks[index + 1], "start"),
  };
}
