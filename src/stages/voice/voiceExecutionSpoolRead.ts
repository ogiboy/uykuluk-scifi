import { readFile } from "node:fs/promises";

import { artifactPathAtProjectRoot } from "../../core/artifactPaths.js";
import { artifactPath } from "../../core/artifacts.js";
import { SafeExitError } from "../../core/errors.js";
import { sha256 } from "../../utils/hash.js";
import { readJsonFile } from "../../utils/json.js";
import { canonicalVoiceEvidenceDigest } from "./catalog/voiceCatalogDigest.js";
import { requireMatchingVoiceExecutionPreflight } from "./voiceExecutionPreflight.js";
import {
  operationIdSchema,
  persistedVoiceExecutionSpoolSchema,
  voiceExecutionSpoolReferenceSchema,
  type LoadedVoiceExecutionSpool,
  type VoiceExecutionSpoolReference,
} from "./voiceExecutionSpoolContracts.js";
import {
  requireMatchingSpoolPreparation,
  requireSelectedSpoolBinding,
  sha256Buffer,
} from "./voiceExecutionSpoolValidation.js";
import { persistedAlignmentSchema } from "./voiceoverEvidenceValidation.js";
import { voiceoverPreparationV2Schema } from "./voiceoverPreparation.js";

/** Loads a committed result spool and verifies all referenced bytes and canonical snapshots. */
export async function loadVoiceExecutionSpool(
  runId: string,
  rawReference: VoiceExecutionSpoolReference,
): Promise<LoadedVoiceExecutionSpool> {
  return loadVoiceExecutionSpoolAtProjectRoot(process.cwd(), runId, rawReference);
}

/** Loads and validates a committed result spool beneath an explicit producer project root. */
export async function loadVoiceExecutionSpoolAtProjectRoot(
  projectRoot: string,
  runId: string,
  rawReference: VoiceExecutionSpoolReference,
): Promise<LoadedVoiceExecutionSpool> {
  const resolveArtifact = (relativePath: string) =>
    artifactPathAtProjectRoot(projectRoot, runId, relativePath);
  const reference = voiceExecutionSpoolReferenceSchema.parse(rawReference);
  const expectedPath = `operations/tts/${reference.operationId}/result.json`;
  if (reference.path !== expectedPath) {
    throw new SafeExitError("Voice execution spool path does not match its operation id.");
  }
  const spool = persistedVoiceExecutionSpoolSchema.parse(
    await readJsonFile<unknown>(resolveArtifact(reference.path)),
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
  if (spool.schemaVersion === 1) {
    throw new SafeExitError(
      "Legacy ElevenLabs voice spool cannot be recovered safely because it does not identify original alignment. Automatic recovery and synthesis retry are blocked; operator intervention is required.",
    );
  }
  const binding = requireSelectedSpoolBinding(spool);
  const preflight = requireMatchingVoiceExecutionPreflight(spool.liveValidation, binding);
  const audioBuffer = await readFile(resolveArtifact(spool.audio.path));
  const originalAlignmentText = await readFile(
    resolveArtifact(spool.alignments.original.path),
    "utf8",
  );
  const normalizedAlignmentText = spool.alignments.normalized
    ? await readFile(resolveArtifact(spool.alignments.normalized.path), "utf8")
    : undefined;
  const preparedText = await readFile(resolveArtifact(spool.preparation.text.path), "utf8");
  const preparationEvidenceText = await readFile(
    resolveArtifact(spool.preparation.evidence.path),
    "utf8",
  );
  if (
    audioBuffer.byteLength !== spool.audio.bytes ||
    sha256Buffer(audioBuffer) !== spool.audio.sha256 ||
    sha256(originalAlignmentText) !== spool.alignments.original.sha256 ||
    (spool.alignments.normalized &&
      (!normalizedAlignmentText ||
        sha256(normalizedAlignmentText) !== spool.alignments.normalized.sha256)) ||
    Buffer.byteLength(preparedText, "utf8") !== spool.preparation.text.bytes ||
    sha256(preparedText) !== spool.preparation.text.sha256 ||
    Buffer.byteLength(preparationEvidenceText, "utf8") !== spool.preparation.evidence.bytes ||
    sha256(preparationEvidenceText) !== spool.preparation.evidence.sha256
  ) {
    throw new SafeExitError("Voice execution spool audio or alignment digest is invalid.");
  }
  const originalAlignment = persistedAlignmentSchema.parse(
    JSON.parse(originalAlignmentText) as unknown,
  );
  const normalizedAlignment = normalizedAlignmentText
    ? persistedAlignmentSchema.parse(JSON.parse(normalizedAlignmentText) as unknown)
    : undefined;
  const preparation = voiceoverPreparationV2Schema.parse(
    JSON.parse(preparationEvidenceText) as unknown,
  );
  if (
    originalAlignment.characters.length !== spool.alignments.original.characterCount ||
    (spool.alignments.normalized &&
      normalizedAlignment?.characters.length !== spool.alignments.normalized.characterCount)
  ) {
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
      digest: spool.alignments.original.sha256,
      characterCount: spool.alignments.original.characterCount,
    },
    ...(spool.alignments.normalized
      ? {
          normalizedAlignmentReference: {
            digest: spool.alignments.normalized.sha256,
            characterCount: spool.alignments.normalized.characterCount,
          },
        }
      : {}),
    preparation: {
      text: preparedText,
      evidence: preparation,
      evidenceText: preparationEvidenceText,
    },
    audio: {
      buffer: audioBuffer,
      alignment: originalAlignment,
      ...(normalizedAlignment ? { normalizedAlignment } : {}),
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
  const spool = persistedVoiceExecutionSpoolSchema.parse(
    await readJsonFile<unknown>(artifactPath(runId, path)),
  );
  return loadVoiceExecutionSpool(runId, {
    operationId,
    path,
    digest: expectedDigest ?? spool.spoolDigest,
  });
}
