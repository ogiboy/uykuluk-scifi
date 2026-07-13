import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { z } from "zod";

import { artifactPath } from "../../core/artifacts.js";
import { SafeExitError } from "../../core/errors.js";
import { writeBinaryFile, writeTextFile } from "../../utils/fs.js";
import { sha256 } from "../../utils/hash.js";
import { readJsonFile, writeJsonFile } from "../../utils/json.js";
import { nowIso } from "../../utils/time.js";
import { sha256Schema } from "./catalog/voiceCatalogContracts.js";
import { canonicalVoiceEvidenceDigest } from "./catalog/voiceCatalogDigest.js";
import { splitElevenLabsText } from "./elevenLabsTextChunks.js";
import {
  elevenLabsBillingEvidenceSchema,
  elevenLabsRequestEvidenceSchema,
} from "./providers/elevenLabsTtsContracts.js";
import type { TtsSynthesisResult } from "./providers/ttsProvider.js";
import {
  requireMatchingVoiceExecutionInput,
  requireSelectedVoiceExecutionBinding,
  selectedVoiceExecutionBindingSchema,
  type SelectedVoiceExecutionBinding,
} from "./voiceExecutionBinding.js";
import {
  requireMatchingVoiceExecutionPreflight,
  voiceExecutionPreflightReceiptSchema,
  type VoiceExecutionPreflightReceipt,
} from "./voiceExecutionPreflight.js";
import { persistedAlignmentSchema } from "./voiceoverEvidenceValidation.js";
import { voiceoverPreparationSchema, type VoiceoverPreparation } from "./voiceoverPreparation.js";

const operationIdSchema = z.string().regex(/^tts_[a-f0-9]{64}$/);
const spoolPathSchema = z.string().regex(/^operations\/tts\/tts_[a-f0-9]{64}\/result\.json$/);
const preparedTextPathSchema = z
  .string()
  .regex(/^operations\/tts\/tts_[a-f0-9]{64}\/prepared-text\.txt$/);
const preparationEvidencePathSchema = z
  .string()
  .regex(/^operations\/tts\/tts_[a-f0-9]{64}\/preparation\.json$/);

export const voiceExecutionSpoolReferenceSchema = z.strictObject({
  operationId: operationIdSchema,
  path: spoolPathSchema,
  digest: sha256Schema,
});

export type VoiceExecutionSpoolReference = z.infer<typeof voiceExecutionSpoolReferenceSchema>;

const providerSchema = z.strictObject({
  service: z.literal("elevenlabs"),
  modelId: z.string().min(1),
  voiceId: z.string().min(1),
  outputFormat: z.string().min(1),
});

const peakNormalizationSchema = z.strictObject({
  applied: z.boolean(),
  gainDb: z.number().max(0),
  sourcePeakDbfs: z.number().max(0),
  targetPeakDbfs: z.number().negative(),
});

const voiceExecutionSpoolSchema = z.strictObject({
  schemaVersion: z.literal(1),
  runId: z.string().min(1),
  operationId: operationIdSchema,
  binding: selectedVoiceExecutionBindingSchema,
  preparationDigest: sha256Schema,
  preparation: z.strictObject({
    text: z.strictObject({
      path: preparedTextPathSchema,
      sha256: sha256Schema,
      bytes: z.int().positive(),
    }),
    evidence: z.strictObject({
      path: preparationEvidencePathSchema,
      sha256: sha256Schema,
      bytes: z.int().positive(),
    }),
  }),
  approvedQuote: z.strictObject({ quoteDigest: sha256Schema, approvalId: z.string().min(1) }),
  liveValidation: voiceExecutionPreflightReceiptSchema,
  actualUsdMicros: z.int().nonnegative(),
  providerRequestIdHash: sha256Schema.optional(),
  audio: z.strictObject({
    path: z.string().regex(/^operations\/tts\/tts_[a-f0-9]{64}\/result\.wav$/),
    sha256: sha256Schema,
    bytes: z.int().positive(),
  }),
  alignment: z.strictObject({
    path: z.string().regex(/^operations\/tts\/tts_[a-f0-9]{64}\/alignment\.json$/),
    sha256: sha256Schema,
    characterCount: z.int().positive(),
  }),
  result: z.strictObject({
    channels: z.int().positive(),
    durationSeconds: z.number().positive(),
    provider: providerSchema,
    providerBilling: elevenLabsBillingEvidenceSchema,
    providerRequests: z.array(elevenLabsRequestEvidenceSchema).min(1),
    processing: z.strictObject({ peakNormalization: peakNormalizationSchema }).optional(),
    quality: z.literal("elevenlabs"),
    sampleRateHz: z.int().positive(),
  }),
  createdAt: z.iso.datetime(),
  spoolDigest: sha256Schema,
});

type VoiceExecutionSpool = z.infer<typeof voiceExecutionSpoolSchema>;

export type LoadedVoiceExecutionSpool = {
  reference: VoiceExecutionSpoolReference;
  binding: SelectedVoiceExecutionBinding;
  preflight: VoiceExecutionPreflightReceipt;
  approvedQuote: { quoteDigest: string; approvalId: string };
  actualUsdMicros: number;
  providerRequestIdHash?: string;
  alignmentReference: { digest: string; characterCount: number };
  preparation: { text: string; evidence: VoiceoverPreparation; evidenceText: string };
  audio: TtsSynthesisResult;
};

/** Commits provider output locally before the generic cost layer can settle the paid call. */
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
  const preparation = voiceoverPreparationSchema.parse(input.preparation.evidence);
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
  const alignmentPath = `${directory}/alignment.json`;
  const spoolPath = `${directory}/result.json`;
  const preparedTextPath = `${directory}/prepared-text.txt`;
  const preparationEvidencePath = `${directory}/preparation.json`;
  const alignment = input.audio.alignment;
  if (!alignment) throw new SafeExitError("Paid voice spool requires alignment evidence.");
  const alignmentText = `${JSON.stringify(alignment, null, 2)}\n`;
  await writeBinaryFile(artifactPath(input.runId, audioPath), input.audio.buffer);
  await writeTextFile(artifactPath(input.runId, alignmentPath), alignmentText);
  await writeTextFile(artifactPath(input.runId, preparedTextPath), input.preparation.text);
  await writeTextFile(
    artifactPath(input.runId, preparationEvidencePath),
    input.preparation.evidenceText,
  );
  const spoolInput = {
    schemaVersion: 1 as const,
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
    alignment: {
      path: alignmentPath,
      sha256: sha256(alignmentText),
      characterCount: alignment.characters.length,
    },
    result: {
      channels: input.audio.channels,
      durationSeconds: input.audio.durationSeconds,
      provider: providerSchema.parse(input.audio.provider),
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

function requireMatchingRequestEvidence(
  audio: TtsSynthesisResult,
  binding: SelectedVoiceExecutionBinding,
  preparedText: string,
): void {
  const chunks = splitElevenLabsText(preparedText, binding.synthesis.maxCharactersPerRequest);
  const requests = audio.providerRequests;
  if (
    requests?.length !== chunks.length ||
    requests.some(
      (request, index) =>
        request.chunkIndex !== index || request.textDigest !== sha256(chunks[index] ?? ""),
    ) ||
    requests.reduce((sum, request) => sum + request.reportedBillableCredits, 0) !==
      audio.providerBilling?.billableCredits
  ) {
    throw new SafeExitError("Paid voice request diagnostics do not match the execution binding.");
  }
}

function requireMatchingSpoolPreparation(
  spool: VoiceExecutionSpool,
  preparation: VoiceoverPreparation,
  preparedText: string,
  evidenceText: string,
): void {
  if (
    preparation.runId !== spool.runId ||
    preparation.output.sha256 !== spool.preparationDigest ||
    preparation.output.sha256 !== spool.preparation.text.sha256 ||
    preparation.output.characterCount !== preparedText.length ||
    `${JSON.stringify(preparation, null, 2)}\n` !== evidenceText
  ) {
    throw new SafeExitError("Voice execution spool preparation evidence is invalid.");
  }
  requireMatchingVoiceExecutionInput(spool.binding, {
    preparedText,
    preparationDigest: preparation.output.sha256,
  });
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

function requireSelectedSpoolBinding(spool: VoiceExecutionSpool): SelectedVoiceExecutionBinding {
  const binding = requireSelectedVoiceExecutionBinding(spool.binding);
  if (binding.input.preparedTextDigest !== spool.preparationDigest) {
    throw new SafeExitError("Voice execution spool preparation digest does not match its binding.");
  }
  return binding;
}

function requireSpoolableAudio(
  audio: TtsSynthesisResult,
  binding: SelectedVoiceExecutionBinding,
  actualUsdMicros: number,
): void {
  if (
    audio.quality !== "elevenlabs" ||
    audio.outputAlreadyPersisted ||
    !audio.alignment ||
    audio.providerBilling?.baseUsdPerThousandBillableCredits !==
      binding.pricing.baseUsdPerThousandCharacters ||
    audio.providerBilling.derivedUsdMicros !== actualUsdMicros ||
    audio.provider?.service !== "elevenlabs" ||
    audio.provider.modelId !== binding.model.modelId ||
    audio.provider.voiceId !== binding.voice.voiceId ||
    audio.provider.outputFormat !== binding.synthesis.outputFormat
  ) {
    throw new SafeExitError("Paid voice result does not match its execution binding.");
  }
}

function sha256Buffer(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}
