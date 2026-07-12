import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { artifactPath } from "../../core/artifacts.js";
import { SafeExitError } from "../../core/errors.js";
import { RunRecord } from "../../core/state.js";
import { pathExists } from "../../utils/fs.js";
import { readJsonFile } from "../../utils/json.js";
import { digestSchema } from "../render/renderPlanSchemas.js";
import { readRenderPlanEvidence } from "../renderPlan.js";
import { voiceoverAudioPath } from "./voiceoverPaths.js";
import {
  voiceoverPreparationPath,
  voiceoverPreparationSchema,
  voiceoverPreparedTextPath,
} from "./voiceoverPreparation.js";
import { voiceoverLocalPlaybackPath } from "./voiceoverReviewCommands.js";

export { voiceoverAudioPath } from "./voiceoverPaths.js";
export const voiceoverAudioMetaPath = "production/audio/voiceover.meta.json";
export const voiceoverAudioReviewPath = "production/audio/voiceover_review.md";
export const voiceoverAudioArtifactPaths = [
  voiceoverAudioPath,
  voiceoverAudioMetaPath,
  voiceoverAudioReviewPath,
] as const;

export const voiceoverAudioMetaSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    runId: z.string().min(1),
    createdAt: z.iso.datetime(),
    mode: z.enum(["deterministic-local", "local-piper"]),
    quality: z.enum(["deterministic-local-reference", "local-piper"]),
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
      })
      .optional(),
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
  })
  .superRefine((meta, context) => {
    if (meta.mode !== "local-piper") {
      return;
    }
    if (!meta.provider) {
      context.addIssue({
        code: "custom",
        message: "Local Piper voiceover metadata requires provider provenance.",
        path: ["provider"],
      });
      return;
    }
    for (const field of ["modelPath", "modelSha256"] as const) {
      if (!meta.provider[field]) {
        context.addIssue({
          code: "custom",
          message: `Local Piper voiceover metadata requires provider.${field}.`,
          path: ["provider", field],
        });
      }
    }
    if (meta.provider.configPath && !meta.provider.configSha256) {
      context.addIssue({
        code: "custom",
        message:
          "Local Piper voiceover metadata requires provider.configSha256 when configPath is present.",
        path: ["provider", "configSha256"],
      });
    }
  });

export type VoiceoverAudioMeta = z.infer<typeof voiceoverAudioMetaSchema>;

export type VoiceoverAudioEvidence =
  | { status: "missing"; requiredArtifacts: readonly string[] }
  | {
      status: "pass";
      path: string;
      digest: string;
      durationSeconds: number;
      localPlaybackPath: string;
      mode: VoiceoverAudioMeta["mode"];
      productionVoiceCandidate: boolean;
      provider?: NonNullable<VoiceoverAudioMeta["provider"]>;
      quality: VoiceoverAudioMeta["quality"];
      reviewPath: string;
      sourceWordCount: number;
    }
  | { status: "block"; path: string; message: string };

/**
 * Reads evidence for the generated voiceover audio artifact.
 *
 * @param run - The run record to inspect.
 * @returns The voiceover evidence status, including a pass record when the audio and metadata validate, a missing record when no required artifacts are present, or a block record when validation fails.
 */
export async function readVoiceoverAudioEvidence(run: RunRecord): Promise<VoiceoverAudioEvidence> {
  const registered = voiceoverAudioArtifactPaths.some((relativePath) =>
    run.artifacts.includes(relativePath),
  );
  const exists = await Promise.all(
    voiceoverAudioArtifactPaths.map((relativePath) =>
      pathExists(artifactPath(run.runId, relativePath)),
    ),
  );
  if (!registered && exists.every((item) => !item)) {
    return { status: "missing", requiredArtifacts: voiceoverAudioArtifactPaths };
  }

  try {
    await assertVoiceoverArtifacts(run);
    const meta = voiceoverAudioMetaSchema.parse(
      await readJsonFile(artifactPath(run.runId, voiceoverAudioMetaPath)),
    );
    if (meta.runId !== run.runId) {
      throw new SafeExitError("Voiceover metadata run id does not match this run.");
    }
    const audio = await readFile(artifactPath(run.runId, voiceoverAudioPath));
    const digest = createHash("sha256").update(audio).digest("hex");
    if (digest !== meta.output.sha256) {
      throw new SafeExitError("Voiceover audio digest does not match metadata.");
    }
    await assertVoiceoverSource(run, meta);
    const renderPlan = await readRenderPlanEvidence(run);
    if (renderPlan.status !== "pass" || renderPlan.digest !== meta.renderPlan.digest) {
      throw new SafeExitError("Voiceover audio was generated from a stale or missing render plan.");
    }
    return {
      status: "pass",
      path: voiceoverAudioPath,
      digest,
      durationSeconds: meta.output.durationSeconds,
      localPlaybackPath: voiceoverLocalPlaybackPath(run.runId),
      mode: meta.mode,
      productionVoiceCandidate: meta.quality === "local-piper",
      provider: meta.provider,
      quality: meta.quality,
      reviewPath: voiceoverAudioReviewPath,
      sourceWordCount: meta.source.wordCount,
    };
  } catch (error) {
    return {
      status: "block",
      path: voiceoverAudioPath,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

async function assertVoiceoverSource(run: RunRecord, meta: VoiceoverAudioMeta): Promise<void> {
  const sourceText = await readFile(artifactPath(run.runId, meta.source.path), "utf8");
  if (createHash("sha256").update(sourceText, "utf8").digest("hex") !== meta.source.sha256) {
    throw new SafeExitError("Voiceover source text digest does not match metadata.");
  }
  if (!meta.source.preparation) {
    return;
  }
  for (const relativePath of [meta.source.preparation.path, meta.source.preparation.metadataPath]) {
    if (!run.artifacts.includes(relativePath)) {
      throw new SafeExitError(`Voiceover preparation artifact is not registered: ${relativePath}.`);
    }
    if (!(await pathExists(artifactPath(run.runId, relativePath)))) {
      throw new SafeExitError(`Voiceover preparation artifact is missing: ${relativePath}.`);
    }
  }
  const preparedText = await readFile(
    artifactPath(run.runId, meta.source.preparation.path),
    "utf8",
  );
  if (
    createHash("sha256").update(preparedText, "utf8").digest("hex") !==
    meta.source.preparation.sha256
  ) {
    throw new SafeExitError("Prepared voiceover text digest does not match metadata.");
  }
  const preparationText = await readFile(
    artifactPath(run.runId, meta.source.preparation.metadataPath),
    "utf8",
  );
  if (
    createHash("sha256").update(preparationText, "utf8").digest("hex") !==
    meta.source.preparation.metadataSha256
  ) {
    throw new SafeExitError("Voiceover preparation metadata digest does not match voice metadata.");
  }
  const preparation = voiceoverPreparationSchema.parse(JSON.parse(preparationText) as unknown);
  if (
    preparation.runId !== run.runId ||
    preparation.source.sha256 !== meta.source.sha256 ||
    preparation.output.sha256 !== meta.source.preparation.sha256 ||
    preparation.replacements.length !== meta.source.preparation.replacementsApplied
  ) {
    throw new SafeExitError("Voiceover preparation evidence does not match voice metadata.");
  }
}

async function assertVoiceoverArtifacts(run: RunRecord): Promise<void> {
  for (const relativePath of voiceoverAudioArtifactPaths) {
    if (!run.artifacts.includes(relativePath)) {
      throw new SafeExitError(`Voiceover artifact is not registered: ${relativePath}.`);
    }
    if (!(await pathExists(artifactPath(run.runId, relativePath)))) {
      throw new SafeExitError(`Voiceover artifact is missing: ${relativePath}.`);
    }
  }
}
