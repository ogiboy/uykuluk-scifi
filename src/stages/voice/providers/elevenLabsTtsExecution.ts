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

/**
 * Executes approval-reserved ElevenLabs synthesis within the caller's timeout and spend ceiling.
 *
 * Provider calls are chunked and return redacted request evidence. Any timeout, provider failure,
 * indeterminate billing, or charge above the reserved maximum returns an uncertain outcome so the
 * reservation owner can fail closed instead of treating the call as safely settled.
 */
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
    const normalizedAlignments: Array<TtsCharacterAlignment | undefined> = [];
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
      const reportedCharacterCost = validCharacterCost(response.characterCost);
      if (reportedCharacterCost === null) {
        return {
          kind: "unknown",
          reason: "indeterminate",
          providerRequestId: response.requestId,
          requestEvidence: [...requestEvidence, redactedRequest],
        };
      }
      requestEvidence.push({ ...redactedRequest, reportedUnits: reportedCharacterCost });
      const sourceBuffer = Buffer.from(response.audioBase64, "base64");
      const chunkWav = readWavInfo(sourceBuffer);
      audioChunks.push(sourceBuffer);
      const alignment = parseElevenLabsAlignment(response.alignment, chunkWav.durationSeconds);
      requireExactOriginalAlignmentText(alignment, text, `chunk ${index + 1}`);
      alignments.push(alignment);
      normalizedAlignments.push(
        parseNormalizedAlignmentForDiagnostics(
          response.normalizedAlignment,
          chunkWav.durationSeconds,
        ),
      );
      characterCost += reportedCharacterCost;
      requestDiagnostics.push({
        chunkIndex: index,
        textDigest: redactedRequest.inputDigest,
        ...(redactedRequest.requestIdHash ? { requestIdHash: redactedRequest.requestIdHash } : {}),
        reportedBillableCredits: reportedCharacterCost,
      });
      if (response.requestId) requestIds.push(response.requestId);
    }
    const stitched = concatenatePcm16Wavs(audioChunks);
    const alignment = stitchElevenLabsAlignments(alignments, audioChunks);
    requireExactOriginalAlignmentText(alignment, input.synthesisInput.text, "stitched synthesis");
    const normalizedAlignment = stitchCompleteNormalizedAlignments(
      normalizedAlignments,
      audioChunks,
    );
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
        ...(normalizedAlignment ? { normalizedAlignment } : {}),
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

function validCharacterCost(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function stitchCompleteNormalizedAlignments(
  alignments: readonly (TtsCharacterAlignment | undefined)[],
  audioChunks: readonly Buffer[],
): TtsCharacterAlignment | undefined {
  return alignments.every((item): item is TtsCharacterAlignment => item !== undefined)
    ? stitchElevenLabsAlignments(alignments, audioChunks)
    : undefined;
}

function parseNormalizedAlignmentForDiagnostics(
  alignment: TtsCharacterAlignment | undefined,
  durationSeconds: number,
): TtsCharacterAlignment | undefined {
  if (!alignment) return undefined;
  try {
    return parseElevenLabsAlignment(alignment, durationSeconds);
  } catch {
    return undefined;
  }
}

function requireExactOriginalAlignmentText(
  alignment: TtsCharacterAlignment,
  expectedText: string,
  scope: string,
): void {
  if (alignment.characters.join("") !== expectedText) {
    throw new Error(`ElevenLabs original alignment text does not match ${scope}.`);
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
