import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { artifactPath } from "../core/artifacts.js";
import { SafeExitError } from "../core/errors.js";
import { RunRecord } from "../core/state.js";
import { pathExists } from "../utils/fs.js";
import { readJsonFile } from "../utils/json.js";
import { readRenderPlanEvidence } from "./renderPlan.js";
import { digestSchema } from "./renderPlanSchemas.js";

export const voiceoverAudioPath = "production/audio/voiceover.wav";
export const voiceoverAudioMetaPath = "production/audio/voiceover.meta.json";
export const voiceoverAudioArtifactPaths = [voiceoverAudioPath, voiceoverAudioMetaPath] as const;

export const voiceoverAudioMetaSchema = z.strictObject({
  schemaVersion: z.literal(1),
  runId: z.string().min(1),
  createdAt: z.iso.datetime(),
  mode: z.enum(["deterministic-local", "local-piper"]),
  quality: z.enum(["deterministic-local-reference", "local-piper"]),
  source: z.strictObject({
    path: z.literal("production/voiceover.txt"),
    sha256: digestSchema,
    wordCount: z.int().positive(),
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
      configPath: z.string().min(1).optional(),
    })
    .optional(),
});

export type VoiceoverAudioMeta = z.infer<typeof voiceoverAudioMetaSchema>;

export type VoiceoverAudioEvidence =
  | { status: "missing"; requiredArtifacts: readonly string[] }
  | {
      status: "pass";
      path: string;
      digest: string;
      durationSeconds: number;
      mode: VoiceoverAudioMeta["mode"];
      sourceWordCount: number;
    }
  | { status: "block"; path: string; message: string };

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
    const renderPlan = await readRenderPlanEvidence(run);
    if (renderPlan.status !== "pass" || renderPlan.digest !== meta.renderPlan.digest) {
      throw new SafeExitError("Voiceover audio was generated from a stale or missing render plan.");
    }
    return {
      status: "pass",
      path: voiceoverAudioPath,
      digest,
      durationSeconds: meta.output.durationSeconds,
      mode: meta.mode,
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
