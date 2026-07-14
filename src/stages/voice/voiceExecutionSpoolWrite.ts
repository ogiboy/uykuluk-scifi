import { z } from "zod";

import { artifactPath } from "../../core/artifacts.js";
import { SafeExitError } from "../../core/errors.js";
import { writeBinaryFile, writeTextFile } from "../../utils/fs.js";
import { sha256 } from "../../utils/hash.js";
import { writeJsonFile } from "../../utils/json.js";
import { nowIso } from "../../utils/time.js";
import { canonicalVoiceEvidenceDigest } from "./catalog/voiceCatalogDigest.js";
import {
  elevenLabsBillingEvidenceSchema,
  elevenLabsRequestEvidenceSchema,
} from "./providers/elevenLabsTtsContracts.js";
import type { TtsSynthesisResult } from "./providers/ttsProvider.js";
import {
  requireMatchingVoiceExecutionInput,
  type SelectedVoiceExecutionBinding,
} from "./voiceExecutionBinding.js";
import {
  requireMatchingVoiceExecutionPreflight,
  type VoiceExecutionPreflightReceipt,
} from "./voiceExecutionPreflight.js";
import {
  operationIdSchema,
  voiceExecutionSpoolProviderSchema,
  voiceExecutionSpoolSchema,
  type LoadedVoiceExecutionSpool,
} from "./voiceExecutionSpoolContracts.js";
import { loadVoiceExecutionSpool } from "./voiceExecutionSpoolRead.js";
import {
  requireMatchingRequestEvidence,
  requireSpoolableAudio,
  sha256Buffer,
} from "./voiceExecutionSpoolValidation.js";
import { parseVoiceoverPreparationV2, type VoiceoverPreparation } from "./voiceoverPreparation.js";

/**
 * Persists validated voice execution artifacts and their integrity metadata, then loads the committed spool.
 *
 * @param input - Execution data, preparation evidence, approved quote, preflight receipt, cost, and provider output to persist.
 * @returns The fully validated persisted voice execution spool.
 * @throws SafeExitError If preparation, preflight, audio, alignment, or provider evidence is inconsistent.
 */
export async function persistVoiceExecutionSpool(input: {
  runId: string;
  operationId: string;
  binding: SelectedVoiceExecutionBinding;
  preparation: { text: string; evidence: VoiceoverPreparation; evidenceText: string };
  approvedQuote: { quoteDigest: string; approvalId: string };
  preflight: VoiceExecutionPreflightReceipt;
  actualUsdMicros: number;
  providerRequestId?: string;
  audio: TtsSynthesisResult;
}): Promise<LoadedVoiceExecutionSpool> {
  const operationId = operationIdSchema.parse(input.operationId);
  const preparation = parseVoiceoverPreparationV2(input.preparation.evidence);
  if (`${JSON.stringify(preparation, null, 2)}\n` !== input.preparation.evidenceText) {
    throw new SafeExitError("Paid voice spool requires canonical preparation evidence.");
  }
  const binding = requireMatchingVoiceExecutionInput(input.binding, {
    preparedText: input.preparation.text,
    preparationDigest: preparation.output.sha256,
  });
  const preflight = requireMatchingVoiceExecutionPreflight(input.preflight, binding);
  requireSpoolableAudio(input.audio, binding, input.actualUsdMicros);
  requireMatchingRequestEvidence(input.audio, binding, input.preparation.text);
  const directory = `operations/tts/${operationId}`;
  const audioPath = `${directory}/result.wav`;
  const originalAlignmentPath = `${directory}/alignment.original.json`;
  const normalizedAlignmentPath = `${directory}/alignment.normalized.json`;
  const spoolPath = `${directory}/result.json`;
  const preparedTextPath = `${directory}/prepared-text.txt`;
  const preparationEvidencePath = `${directory}/preparation.json`;
  const originalAlignment = input.audio.alignment;
  if (!originalAlignment) {
    throw new SafeExitError("Paid voice spool requires original alignment evidence.");
  }
  const originalAlignmentText = `${JSON.stringify(originalAlignment, null, 2)}\n`;
  const normalizedAlignmentText = input.audio.normalizedAlignment
    ? `${JSON.stringify(input.audio.normalizedAlignment, null, 2)}\n`
    : undefined;
  await writeBinaryFile(artifactPath(input.runId, audioPath), input.audio.buffer);
  await writeTextFile(artifactPath(input.runId, originalAlignmentPath), originalAlignmentText);
  if (normalizedAlignmentText) {
    await writeTextFile(
      artifactPath(input.runId, normalizedAlignmentPath),
      normalizedAlignmentText,
    );
  }
  await writeTextFile(artifactPath(input.runId, preparedTextPath), input.preparation.text);
  await writeTextFile(
    artifactPath(input.runId, preparationEvidencePath),
    input.preparation.evidenceText,
  );
  const spoolInput = {
    schemaVersion: 2 as const,
    runId: input.runId,
    operationId,
    binding,
    preparationDigest: preparation.output.sha256,
    preparation: {
      text: {
        path: preparedTextPath,
        sha256: sha256(input.preparation.text),
        bytes: Buffer.byteLength(input.preparation.text, "utf8"),
      },
      evidence: {
        path: preparationEvidencePath,
        sha256: sha256(input.preparation.evidenceText),
        bytes: Buffer.byteLength(input.preparation.evidenceText, "utf8"),
      },
    },
    approvedQuote: input.approvedQuote,
    liveValidation: preflight,
    actualUsdMicros: input.actualUsdMicros,
    ...(input.providerRequestId ? { providerRequestIdHash: sha256(input.providerRequestId) } : {}),
    audio: {
      path: audioPath,
      sha256: sha256Buffer(input.audio.buffer),
      bytes: input.audio.buffer.byteLength,
    },
    alignments: {
      authority: "original" as const,
      original: {
        path: originalAlignmentPath,
        sha256: sha256(originalAlignmentText),
        characterCount: originalAlignment.characters.length,
      },
      ...(normalizedAlignmentText && input.audio.normalizedAlignment
        ? {
            normalized: {
              path: normalizedAlignmentPath,
              sha256: sha256(normalizedAlignmentText),
              characterCount: input.audio.normalizedAlignment.characters.length,
            },
          }
        : {}),
    },
    result: {
      channels: input.audio.channels,
      durationSeconds: input.audio.durationSeconds,
      provider: voiceExecutionSpoolProviderSchema.parse(input.audio.provider),
      providerBilling: elevenLabsBillingEvidenceSchema.parse(input.audio.providerBilling),
      providerRequests: z
        .array(elevenLabsRequestEvidenceSchema)
        .min(1)
        .parse(input.audio.providerRequests),
      ...(input.audio.processing ? { processing: input.audio.processing } : {}),
      quality: "elevenlabs" as const,
      sampleRateHz: input.audio.sampleRateHz,
    },
    createdAt: nowIso(),
  };
  const spool = voiceExecutionSpoolSchema.parse({
    ...spoolInput,
    spoolDigest: canonicalVoiceEvidenceDigest(spoolInput),
  });
  await writeJsonFile(artifactPath(input.runId, spoolPath), spool);
  return loadVoiceExecutionSpool(input.runId, {
    operationId,
    path: spoolPath,
    digest: spool.spoolDigest,
  });
}
