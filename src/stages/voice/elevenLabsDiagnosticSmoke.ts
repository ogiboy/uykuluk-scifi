import { createHash } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { SafeExitError } from "../../core/errors.js";
import { writeBinaryFile } from "../../utils/fs.js";
import { sha256 } from "../../utils/hash.js";
import { writeJsonFile } from "../../utils/json.js";
import { createId, nowIso } from "../../utils/time.js";
import {
  providerSmokeEvidenceSchema,
  type ProviderSmokeEvidence,
} from "../providers/providerSmokeEvidence.js";
import { voiceIdSchema } from "./catalog/voiceCatalogContracts.js";
import { parseElevenLabsAlignment } from "./elevenLabsAlignment.js";
import {
  resolveDiagnosticPreflight,
  type DiagnosticPreflightDependencies,
} from "./elevenLabsDiagnosticPreflight.js";
import {
  requestDiagnosticTiming,
  type DiagnosticTimingDependencies,
} from "./elevenLabsDiagnosticRequest.js";
import { readWavInfo } from "./voiceWav.js";

const defaultDiagnosticText =
  "Merhaba. Bu kısa kayıt, Türkçe ElevenLabs v3 ses ve zamanlama bağlantısını doğrular.";

export const elevenLabsDiagnosticSmokeRequestSchema = z.strictObject({
  voiceId: voiceIdSchema,
  text: z.string().trim().min(1).max(180).default(defaultDiagnosticText),
});

export type ElevenLabsDiagnosticSmokeRequest = z.input<
  typeof elevenLabsDiagnosticSmokeRequestSchema
>;

type DiagnosticDependencies = DiagnosticPreflightDependencies &
  DiagnosticTimingDependencies & { createOperationId?: () => string; now?: () => string };

/**
 * Runs one bounded ElevenLabs v3 diagnostic and persists non-production audio and evidence.
 * The entitlement preflight rejects overage-capable accounts and insufficient included credits
 * before the TTS request is sent.
 */
export async function runElevenLabsDiagnosticSmoke(
  projectRoot: string,
  rawRequest: ElevenLabsDiagnosticSmokeRequest,
  dependencies: DiagnosticDependencies = {},
): Promise<ProviderSmokeEvidence> {
  const request = elevenLabsDiagnosticSmokeRequestSchema.parse(rawRequest);
  const createdAt = (dependencies.now ?? nowIso)();
  const operationId = (dependencies.createOperationId ?? (() => createId("provider_smoke")))();
  const base = {
    schemaVersion: 1 as const,
    provider: "elevenlabs" as const,
    capability: "text-to-speech-with-timestamps" as const,
    operationId,
    usage: "diagnostic-only" as const,
    productionEligible: false as const,
    createdAt,
    completedAt: createdAt,
    modelId: "eleven_v3" as const,
    voiceId: request.voiceId,
    inputDigest: sha256(request.text),
    inputCharacterCount: request.text.length,
  };
  const evidencePath = diagnosticEvidencePath(projectRoot, operationId);
  const preflight = await resolveDiagnosticPreflight(
    projectRoot,
    request.text.length,
    dependencies,
    base,
  );
  if (preflight.kind === "blocked") {
    return persistBlocked(evidencePath, preflight.base, preflight.reason, preflight.message);
  }
  const { apiKey, elevenLabsConfig, preflightBase, entitlement } = preflight.value;
  const timeoutMs = Math.min(elevenLabsConfig.timeoutMs, 120_000);
  await writeJsonFile(
    evidencePath,
    providerSmokeEvidenceSchema.parse({
      ...preflightBase,
      completedAt: (dependencies.now ?? nowIso)(),
      status: "unknown",
      requestSent: true,
      reason: "in-progress",
      message: "Diagnostic request started; automatic retry is disabled.",
    }),
  );
  const timing = await requestDiagnosticTiming(
    apiKey,
    elevenLabsConfig,
    request,
    dependencies,
    timeoutMs,
  );
  if (timing.kind === "failure") {
    return persistFailure(
      evidencePath,
      { ...preflightBase, requestSent: true, ...timing.failure.evidence },
      timing.failure.reason,
      timing.failure.message,
    );
  }
  const { response } = timing;

  try {
    const audio = Buffer.from(response.audioBase64, "base64");
    const wav = readWavInfo(audio);
    const alignment = parseElevenLabsAlignment(response.alignment, wav.durationSeconds);
    if (alignment.characters.join("") !== request.text) {
      throw new SafeExitError("ElevenLabs diagnostic alignment does not match the requested text.");
    }
    if (
      response.characterCost === undefined ||
      response.characterCost > entitlement.remainingCredits
    ) {
      throw new SafeExitError("ElevenLabs diagnostic returned invalid billing evidence.");
    }
    const relativeAudioPath = diagnosticAudioRelativePath(operationId);
    const absoluteAudioPath = path.join(projectRoot, relativeAudioPath);
    const evidence = providerSmokeEvidenceSchema.parse({
      ...preflightBase,
      completedAt: (dependencies.now ?? nowIso)(),
      status: "succeeded",
      requestSent: true,
      ...(response.requestId ? { providerRequestIdHash: sha256(response.requestId) } : {}),
      audio: {
        path: relativeAudioPath,
        digest: createHash("sha256").update(audio).digest("hex"),
        durationSeconds: wav.durationSeconds,
        sampleRateHz: wav.sampleRateHz,
        channels: wav.channels,
      },
      alignmentDigest: sha256(JSON.stringify(alignment)),
      reportedBillableCredits: response.characterCost,
    });
    await writeBinaryFile(absoluteAudioPath, audio);
    try {
      await writeJsonFile(evidencePath, evidence);
    } catch (error) {
      await rm(absoluteAudioPath, { force: true }).catch(() => undefined);
      throw error;
    }
    return evidence;
  } catch (error) {
    await persistFailure(
      evidencePath,
      {
        ...preflightBase,
        requestSent: true,
        ...(response.requestId ? { providerRequestIdHash: sha256(response.requestId) } : {}),
      },
      "response-invalid",
      "ElevenLabs diagnostic response could not be validated for local playback.",
    );
    throw error;
  }
}

async function persistBlocked(
  target: string,
  base: Record<string, unknown>,
  reason: "configuration" | "entitlement" | "provider-rejected",
  message: string,
): Promise<never> {
  return persistFailure(target, { ...base, requestSent: false }, reason, message);
}

async function persistFailure(
  target: string,
  base: Record<string, unknown>,
  reason:
    "configuration" | "entitlement" | "provider-rejected" | "provider-timeout" | "response-invalid",
  message: string,
): Promise<never> {
  const evidence = providerSmokeEvidenceSchema.parse({
    ...base,
    completedAt: nowIso(),
    status: base.requestSent === false ? "blocked" : "failed",
    reason,
    message,
  });
  await writeJsonFile(target, evidence);
  throw new SafeExitError(`${message} Evidence: ${path.relative(process.cwd(), target)}`);
}

function diagnosticAudioRelativePath(operationId: string): string {
  return `diagnostics/provider-smokes/elevenlabs/${operationId}.wav`;
}

function diagnosticEvidencePath(projectRoot: string, operationId: string): string {
  return path.join(
    projectRoot,
    "diagnostics",
    "provider-smokes",
    "elevenlabs",
    `${operationId}.json`,
  );
}
