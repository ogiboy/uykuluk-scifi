import { readFile } from "node:fs/promises";

import { artifactPath } from "../../core/artifacts.js";
import { SafeExitError } from "../../core/errors.js";
import { sha256 } from "../../utils/hash.js";
import { readJsonFile } from "../../utils/json.js";
import { canonicalVoiceEvidenceDigest } from "./catalog/voiceCatalogDigest.js";
import { requireMatchingVoiceExecutionPreflight } from "./voiceExecutionPreflight.js";
import {
  operationIdSchema,
  voiceExecutionSpoolReferenceSchema,
  voiceExecutionSpoolSchema,
  type LoadedVoiceExecutionSpool,
  type VoiceExecutionSpoolReference,
} from "./voiceExecutionSpoolContracts.js";
import {
  requireMatchingSpoolPreparation,
  requireSelectedSpoolBinding,
  sha256Buffer,
} from "./voiceExecutionSpoolValidation.js";
import { persistedAlignmentSchema } from "./voiceoverEvidenceValidation.js";
import { voiceoverPreparationSchema } from "./voiceoverPreparation.js";

/** Loads a committed result spool and verifies all referenced bytes and canonical snapshots. */
export async function loadVoiceExecutionSpool(
  runId: string,
  rawReference: VoiceExecutionSpoolReference,
): Promise<LoadedVoiceExecutionSpool> {
  const reference = voiceExecutionSpoolReferenceSchema.parse(rawReference);
  const expectedPath = `operations/tts/${reference.operationId}/result.json`;
  if (reference.path !== expectedPath) {
    throw new SafeExitError("Voice execution spool path does not match its operation id.");
  }
  const spool = voiceExecutionSpoolSchema.parse(
    await readJsonFile<unknown>(artifactPath(runId, reference.path)),
  );
  const { spoolDigest, ...digestInput } = spool;
  if (
    spool.runId !== runId ||
    spool.operationId !== reference.operationId ||
    spoolDigest !== reference.digest ||
    canonicalVoiceEvidenceDigest(digestInput) !== spoolDigest
  ) {
    throw new SafeExitError("Voice execution spool digest or identity is invalid.");
  }
  const binding = requireSelectedSpoolBinding(spool);
  const preflight = requireMatchingVoiceExecutionPreflight(spool.liveValidation, binding);
  const audioBuffer = await readFile(artifactPath(runId, spool.audio.path));
  const alignmentText = await readFile(artifactPath(runId, spool.alignment.path), "utf8");
  const preparedText = await readFile(artifactPath(runId, spool.preparation.text.path), "utf8");
  const preparationEvidenceText = await readFile(
    artifactPath(runId, spool.preparation.evidence.path),
    "utf8",
  );
  if (
    audioBuffer.byteLength !== spool.audio.bytes ||
    sha256Buffer(audioBuffer) !== spool.audio.sha256 ||
    sha256(alignmentText) !== spool.alignment.sha256 ||
    Buffer.byteLength(preparedText, "utf8") !== spool.preparation.text.bytes ||
    sha256(preparedText) !== spool.preparation.text.sha256 ||
    Buffer.byteLength(preparationEvidenceText, "utf8") !== spool.preparation.evidence.bytes ||
    sha256(preparationEvidenceText) !== spool.preparation.evidence.sha256
  ) {
    throw new SafeExitError("Voice execution spool audio or alignment digest is invalid.");
  }
  const alignment = persistedAlignmentSchema.parse(JSON.parse(alignmentText) as unknown);
  const preparation = voiceoverPreparationSchema.parse(
    JSON.parse(preparationEvidenceText) as unknown,
  );
  if (alignment.characters.length !== spool.alignment.characterCount) {
    throw new SafeExitError("Voice execution spool alignment count is invalid.");
  }
  requireMatchingSpoolPreparation(spool, preparation, preparedText, preparationEvidenceText);
  return {
    reference,
    binding,
    preflight,
    approvedQuote: spool.approvedQuote,
    actualUsdMicros: spool.actualUsdMicros,
    ...(spool.providerRequestIdHash ? { providerRequestIdHash: spool.providerRequestIdHash } : {}),
    alignmentReference: {
      digest: spool.alignment.sha256,
      characterCount: spool.alignment.characterCount,
    },
    preparation: {
      text: preparedText,
      evidence: preparation,
      evidenceText: preparationEvidenceText,
    },
    audio: {
      buffer: audioBuffer,
      alignment,
      channels: spool.result.channels,
      durationSeconds: spool.result.durationSeconds,
      outputAlreadyPersisted: false,
      provider: spool.result.provider,
      providerBilling: spool.result.providerBilling,
      providerRequests: spool.result.providerRequests,
      processing: spool.result.processing,
      quality: spool.result.quality,
      sampleRateHz: spool.result.sampleRateHz,
    },
  };
}

/** Resolves a committed spool from its deterministic operation directory. */
export async function loadVoiceExecutionSpoolForOperation(
  runId: string,
  rawOperationId: string,
  expectedDigest?: string,
): Promise<LoadedVoiceExecutionSpool> {
  const operationId = operationIdSchema.parse(rawOperationId);
  const path = `operations/tts/${operationId}/result.json` as const;
  const spool = voiceExecutionSpoolSchema.parse(
    await readJsonFile<unknown>(artifactPath(runId, path)),
  );
  return loadVoiceExecutionSpool(runId, {
    operationId,
    path,
    digest: expectedDigest ?? spool.spoolDigest,
  });
}
