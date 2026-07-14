import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { artifactPathAtProjectRoot } from "../../core/artifactPaths.js";
import { SafeExitError } from "../../core/errors.js";
import { RunRecord } from "../../core/state.js";
import { pathExists } from "../../utils/fs.js";
import { verifyProductionPackageAtProjectRoot } from "../production/productionPackageIntegrity.js";
import { digestSchema } from "../render/renderPlanSchemas.js";
import { readRenderPlanEvidenceAtProjectRoot } from "../renderPlan.js";
import { paidVoiceExecutionEvidenceSchema } from "./voiceExecutionEvidence.js";
import { assertPaidVoiceExecutionEvidenceAtProjectRoot } from "./voiceExecutionEvidenceValidation.js";
import {
  assertVoiceoverAlignment,
  assertVoiceoverArtifacts,
  assertVoiceoverSource,
  assertVoiceoverSubtitles,
} from "./voiceoverEvidenceValidation.js";
import { refineVoiceoverMeta } from "./voiceoverMetaRefinement.js";
import { voiceoverAudioPath } from "./voiceoverPaths.js";
import { voiceoverPreparationPath, voiceoverPreparedTextPath } from "./voiceoverPreparation.js";
import { voiceoverLocalPlaybackPath } from "./voiceoverReviewCommands.js";
import {
  activeVoiceSubtitleDescriptorSchema,
  inspectVoiceSubtitleSrt,
  type ActiveVoiceSubtitleDescriptor,
} from "./voiceoverSubtitles.js";

export { voiceoverAudioPath } from "./voiceoverPaths.js";
export const voiceoverAudioMetaPath = "production/audio/voiceover.meta.json";
export const voiceoverAudioReviewPath = "production/audio/voiceover_review.md";
export const voiceoverAlignmentPath = "production/audio/alignment.json";
export const voiceoverNormalizedAlignmentPath = "production/audio/alignment.normalized.json";
export const voiceoverAudioArtifactPaths = [
  voiceoverAudioPath,
  voiceoverAudioMetaPath,
  voiceoverAudioReviewPath,
] as const;

const voiceoverAudioMetaBaseShape = {
  runId: z.string().min(1),
  createdAt: z.iso.datetime(),
  mode: z.enum(["deterministic-local", "local-piper", "elevenlabs"]),
  quality: z.enum(["deterministic-local-reference", "local-piper", "elevenlabs"]),
  source: z.strictObject({
    path: z.literal("production/voiceover.txt"),
    sha256: digestSchema,
    wordCount: z.int().positive(),
    preparation: z
      .strictObject({
        path: z.literal(voiceoverPreparedTextPath),
        sha256: digestSchema,
        metadataPath: z.literal(voiceoverPreparationPath),
        metadataSha256: digestSchema,
        replacementsApplied: z.int().nonnegative(),
      })
      .optional(),
  }),
  renderPlan: z.strictObject({
    path: z.literal("production/render_plan.json"),
    digest: digestSchema,
  }),
  output: z.strictObject({
    path: z.literal(voiceoverAudioPath),
    sha256: digestSchema,
    bytes: z.int().positive(),
    durationSeconds: z.number().positive(),
    sampleRateHz: z.int().positive(),
    channels: z.int().positive(),
  }),
  provider: z
    .strictObject({
      binary: z.string().min(1).optional(),
      modelPath: z.string().min(1).optional(),
      modelSha256: digestSchema.optional(),
      configPath: z.string().min(1).optional(),
      configSha256: digestSchema.optional(),
      service: z.literal("elevenlabs").optional(),
      modelId: z.string().min(1).optional(),
      voiceId: z.string().min(1).optional(),
      outputFormat: z.string().min(1).optional(),
    })
    .optional(),
  paidExecution: paidVoiceExecutionEvidenceSchema.optional(),
  processing: z
    .strictObject({
      peakNormalization: z.strictObject({
        applied: z.boolean(),
        gainDb: z.number().max(0),
        sourcePeakDbfs: z.number().max(0),
        targetPeakDbfs: z.number().negative(),
      }),
    })
    .optional(),
  alignment: z
    .strictObject({
      path: z.literal(voiceoverAlignmentPath),
      sha256: digestSchema,
      characterCount: z.int().positive(),
    })
    .optional(),
} as const;

const voiceoverAudioMetaV1Schema = z.strictObject({
  schemaVersion: z.literal(1),
  ...voiceoverAudioMetaBaseShape,
});

const voiceoverAudioMetaV2Schema = z.strictObject({
  schemaVersion: z.literal(2),
  ...voiceoverAudioMetaBaseShape,
  normalizedAlignment: z
    .strictObject({
      path: z.literal(voiceoverNormalizedAlignmentPath),
      sha256: digestSchema,
      characterCount: z.int().positive(),
    })
    .optional(),
  subtitle: activeVoiceSubtitleDescriptorSchema,
});

export const voiceoverAudioMetaSchema = z
  .discriminatedUnion("schemaVersion", [voiceoverAudioMetaV1Schema, voiceoverAudioMetaV2Schema])
  .superRefine(refineVoiceoverMeta);

export type VoiceoverAudioMeta = z.infer<typeof voiceoverAudioMetaSchema>;

export type VoiceoverAudioEvidence =
  | { status: "missing"; requiredArtifacts: readonly string[] }
  | {
      status: "pass";
      path: string;
      digest: string;
      metadataDigest: string;
      durationSeconds: number;
      localPlaybackPath: string;
      mode: VoiceoverAudioMeta["mode"];
      productionVoiceCandidate: boolean;
      alignmentPath?: string;
      normalizedAlignmentPath?: string;
      provider?: NonNullable<VoiceoverAudioMeta["provider"]>;
      quality: VoiceoverAudioMeta["quality"];
      reviewPath: string;
      sourceWordCount: number;
      subtitle: ActiveVoiceSubtitleDescriptor;
    }
  | { status: "block"; path: string; message: string };

/**
 * Reads evidence for the generated voiceover audio artifact.
 *
 * @param run - The run record to inspect.
 * @returns The voiceover evidence status, including a pass record when the audio and metadata validate, a missing record when no required artifacts are present, or a block record when validation fails.
 */
export async function readVoiceoverAudioEvidence(run: RunRecord): Promise<VoiceoverAudioEvidence> {
  return readVoiceoverAudioEvidenceAtProjectRoot(process.cwd(), run);
}

/** Reads canonical voice evidence beneath an explicit producer project root. */
export async function readVoiceoverAudioEvidenceAtProjectRoot(
  projectRoot: string,
  run: RunRecord,
): Promise<VoiceoverAudioEvidence> {
  const resolveArtifact = (relativePath: string) =>
    artifactPathAtProjectRoot(projectRoot, run.runId, relativePath);
  const registered = voiceoverAudioArtifactPaths.some((relativePath) =>
    run.artifacts.includes(relativePath),
  );
  const exists = await Promise.all(
    voiceoverAudioArtifactPaths.map((relativePath) => pathExists(resolveArtifact(relativePath))),
  );
  if (!registered && exists.every((item) => !item)) {
    return { status: "missing", requiredArtifacts: voiceoverAudioArtifactPaths };
  }

  try {
    await assertVoiceoverArtifacts(run, voiceoverAudioArtifactPaths, resolveArtifact);
    const metaText = await readFile(resolveArtifact(voiceoverAudioMetaPath), "utf8");
    const meta = voiceoverAudioMetaSchema.parse(JSON.parse(metaText) as unknown);
    const metadataDigest = createHash("sha256").update(metaText, "utf8").digest("hex");
    if (meta.runId !== run.runId) {
      throw new SafeExitError("Voiceover metadata run id does not match this run.");
    }
    const audio = await readFile(resolveArtifact(voiceoverAudioPath));
    const digest = createHash("sha256").update(audio).digest("hex");
    if (audio.byteLength !== meta.output.bytes || digest !== meta.output.sha256) {
      throw new SafeExitError("Voiceover audio bytes do not match metadata.");
    }
    await assertVoiceoverSource(run, meta, resolveArtifact);
    await assertVoiceoverAlignment(run, meta, resolveArtifact);
    if (meta.schemaVersion === 1 && meta.mode === "elevenlabs") {
      throw new SafeExitError(
        "Legacy ElevenLabs voice evidence is missing authoritative aligned subtitles; regenerate voice before render.",
      );
    }
    await assertPaidVoiceExecutionEvidenceAtProjectRoot(projectRoot, run, meta);
    const renderPlan = await readRenderPlanEvidenceAtProjectRoot(projectRoot, run);
    if (renderPlan.status !== "pass" || renderPlan.digest !== meta.renderPlan.digest) {
      throw new SafeExitError("Voiceover audio was generated from a stale or missing render plan.");
    }
    const subtitle =
      meta.schemaVersion === 2
        ? await assertVoiceoverSubtitles(run, meta, digest, resolveArtifact)
        : await resolveLegacyLocalSubtitle(projectRoot, run, meta, resolveArtifact);
    return {
      status: "pass",
      path: voiceoverAudioPath,
      digest,
      metadataDigest,
      durationSeconds: meta.output.durationSeconds,
      localPlaybackPath: voiceoverLocalPlaybackPath(run.runId),
      mode: meta.mode,
      productionVoiceCandidate: meta.quality !== "deterministic-local-reference",
      alignmentPath: meta.alignment?.path,
      normalizedAlignmentPath:
        meta.schemaVersion === 2 ? meta.normalizedAlignment?.path : undefined,
      provider: meta.provider,
      quality: meta.quality,
      reviewPath: voiceoverAudioReviewPath,
      sourceWordCount: meta.source.wordCount,
      subtitle,
    };
  } catch (error) {
    return {
      status: "block",
      path: voiceoverAudioPath,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

async function resolveLegacyLocalSubtitle(
  projectRoot: string,
  run: RunRecord,
  meta: z.infer<typeof voiceoverAudioMetaV1Schema>,
  resolveArtifact: (relativePath: string) => string,
): Promise<ActiveVoiceSubtitleDescriptor> {
  if (meta.mode === "elevenlabs") {
    throw new SafeExitError(
      "Legacy ElevenLabs voice evidence is missing authoritative aligned subtitles; regenerate voice before render.",
    );
  }
  const packageEvidence = await verifyProductionPackageAtProjectRoot(projectRoot, run);
  const path = "production/subtitles.srt" as const;
  const subtitleText = await readFile(resolveArtifact(path), "utf8");
  const stats = inspectVoiceSubtitleSrt(subtitleText);
  return activeVoiceSubtitleDescriptorSchema.parse({
    timingMode: "linear-fallback",
    path,
    sha256: createHash("sha256").update(subtitleText, "utf8").digest("hex"),
    metadataPath: "production/production_package.meta.json",
    metadataSha256: packageEvidence.digest,
    cueCount: stats.cueCount,
    sourceDurationSeconds: stats.lastCueEndSeconds,
  });
}
