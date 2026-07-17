import { ElevenLabsError, ElevenLabsTimeoutError } from "@elevenlabs/elevenlabs-js";
import { sha256 } from "../../utils/hash.js";
import type { ProviderSmokeErrorCategory } from "../providers/providerSmokeEvidence.js";
import type { ElevenLabsTtsConfig } from "./elevenLabsDiagnosticPreflight.js";
import { createOfficialElevenLabsTimingClient } from "./providers/elevenLabsTimingClient.js";
import type { ElevenLabsTimingClient } from "./providers/elevenLabsTtsContracts.js";

export type DiagnosticTimingDependencies = {
  createTimingClient?: (apiKey: string) => ElevenLabsTimingClient;
};

type DiagnosticProviderFailure = Readonly<{
  reason: "provider-rejected" | "provider-timeout";
  message: string;
  evidence: Readonly<{
    providerStatusCode?: number;
    providerErrorCategory: ProviderSmokeErrorCategory;
    providerRequestIdHash?: string;
  }>;
}>;

export type DiagnosticTimingRequestResult =
  | Readonly<{
      kind: "success";
      response: Awaited<ReturnType<ElevenLabsTimingClient["convertWithTimestamps"]>>;
    }>
  | Readonly<{ kind: "failure"; failure: DiagnosticProviderFailure }>;

export async function requestDiagnosticTiming(
  apiKey: string,
  elevenLabsConfig: ElevenLabsTtsConfig,
  request: Readonly<{ voiceId: string; text: string }>,
  dependencies: DiagnosticTimingDependencies,
  timeoutMs: number,
): Promise<DiagnosticTimingRequestResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await (
      dependencies.createTimingClient ?? createOfficialElevenLabsTimingClient
    )(apiKey).convertWithTimestamps({
      voiceId: request.voiceId,
      text: request.text,
      modelId: "eleven_v3",
      languageCode: "tr",
      applyTextNormalization: elevenLabsConfig.applyTextNormalization,
      seed: elevenLabsConfig.seed,
      outputFormat: elevenLabsConfig.outputFormat,
      voiceSettings: elevenLabsConfig.voiceSettings,
      signal: controller.signal,
      timeoutMs,
      maxRetries: 0,
    });
    return { kind: "success", response };
  } catch (error) {
    return {
      kind: "failure",
      failure: classifyDiagnosticProviderFailure(error, controller.signal.aborted),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function classifyDiagnosticProviderFailure(
  error: unknown,
  aborted: boolean,
): DiagnosticProviderFailure {
  if (aborted || error instanceof ElevenLabsTimeoutError) {
    return {
      reason: "provider-timeout",
      message: "ElevenLabs diagnostic timed out; it will not be retried automatically.",
      evidence: { providerErrorCategory: "timeout" },
    };
  }
  if (!(error instanceof ElevenLabsError)) {
    return {
      reason: "provider-rejected",
      message: "ElevenLabs diagnostic request failed safely; it will not be retried automatically.",
      evidence: { providerErrorCategory: "provider-unavailable" },
    };
  }
  const statusCode = error.statusCode ?? error.rawResponse?.status;
  const requestId = error.rawResponse?.headers.get("request-id")?.trim();
  return {
    reason: "provider-rejected",
    message: "ElevenLabs rejected the diagnostic request; it will not be retried automatically.",
    evidence: {
      ...(isProviderFailureStatus(statusCode) ? { providerStatusCode: statusCode } : {}),
      providerErrorCategory: providerErrorCategoryForStatus(statusCode),
      ...(requestId ? { providerRequestIdHash: sha256(requestId) } : {}),
    },
  };
}

function isProviderFailureStatus(statusCode: number | undefined): statusCode is number {
  return (
    Number.isInteger(statusCode) &&
    statusCode !== undefined &&
    statusCode >= 400 &&
    statusCode <= 599
  );
}

function providerErrorCategoryForStatus(
  statusCode: number | undefined,
): ProviderSmokeErrorCategory {
  if (statusCode === 401) return "authentication";
  if (statusCode === 403) return "access-denied";
  if (statusCode === 429) return "rate-limited";
  if ([400, 404, 409, 422].includes(statusCode ?? -1)) return "invalid-request";
  return "provider-unavailable";
}
