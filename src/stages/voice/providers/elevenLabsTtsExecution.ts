import { usdToMicrosCeil } from "../../../costs/money.js";
import type { ProviderRequestEvidence } from "../../../costs/providerRequestEvidence.js";
import type { ReservedProviderAdapter } from "../../../costs/reservedProviderExecution.js";
import { sha256 } from "../../../utils/hash.js";
import {
  elevenLabsContextText,
  parseElevenLabsAlignment,
  stitchElevenLabsAlignments,
} from "../elevenLabsAlignment.js";
import { splitElevenLabsText } from "../elevenLabsTextChunks.js";
import { concatenatePcm16Wavs, normalizePcm16WavPeak, readWavInfo } from "../voiceWav.js";
import type {
  ElevenLabsTimingClient,
  ElevenLabsTtsProviderConfig,
} from "./elevenLabsTtsContracts.js";
import type {
  TtsCharacterAlignment,
  TtsSynthesisInput,
  TtsSynthesisResult,
} from "./ttsProvider.js";

type ReservedTtsExecution = ReservedProviderAdapter<TtsSynthesisResult>["execute"];
type ReservedTtsContext = Parameters<ReservedTtsExecution>[0];
type ReservedTtsOutcome = Awaited<ReturnType<ReservedTtsExecution>>;

export async function executeElevenLabsReservedSynthesis(input: {
  apiKey: string;
  config: ElevenLabsTtsProviderConfig;
  context: ReservedTtsContext;
  createClient: (apiKey: string) => ElevenLabsTimingClient;
  synthesisInput: TtsSynthesisInput;
}): Promise<ReservedTtsOutcome> {
  let lastProviderRequestId: string | undefined;
  const requestEvidence: ProviderRequestEvidence = [];
  try {
    const client = input.createClient(input.apiKey);
    const chunks = splitElevenLabsText(
      input.synthesisInput.text,
      input.config.maxCharactersPerRequest,
    );
    const audioChunks: Buffer[] = [];
    const alignments: TtsCharacterAlignment[] = [];
    const requestIds: string[] = [];
    const requestDiagnostics: NonNullable<TtsSynthesisResult["providerRequests"]> = [];
    let characterCost = 0;
    for (const [index, text] of chunks.entries()) {
      const requestStitching = requestStitchingFor(input.config.modelId, chunks, index, requestIds);
      const response = await client.convertWithTimestamps({
        voiceId: input.config.voiceId,
        text,
        modelId: input.config.modelId,
        languageCode: input.config.languageCode,
        applyTextNormalization: input.config.applyTextNormalization,
        seed: (input.config.seed + index) % 4_294_967_296,
        ...requestStitching,
        outputFormat: input.config.outputFormat,
        voiceSettings: input.config.voiceSettings,
        signal: input.context.signal,
        timeoutMs: input.config.timeoutMs,
        maxRetries: input.config.maxRetries,
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
      characterCost += response.characterCost;
      requestDiagnostics.push({
        chunkIndex: index,
        textDigest: redactedRequest.inputDigest,
        ...(redactedRequest.requestIdHash ? { requestIdHash: redactedRequest.requestIdHash } : {}),
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
      (characterCost / 1_000) * input.config.billedCreditUsdPerThousandCharacters,
    );
    if (actualUsdMicros > input.context.maxUsdMicros) {
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
          modelId: input.config.modelId,
          voiceId: input.config.voiceId,
          outputFormat: input.config.outputFormat,
        },
        providerBilling: {
          source: "provider-reported-credits-approved-tariff-derived-usd",
          billableCredits: characterCost,
          baseUsdPerThousandBillableCredits: input.config.billedCreditUsdPerThousandCharacters,
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
      reason: input.context.signal.aborted ? "timeout" : "provider-error",
      providerRequestId: lastProviderRequestId,
      ...(requestEvidence.length > 0 ? { requestEvidence } : {}),
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
