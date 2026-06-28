import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { z } from "zod";
import { artifactPath } from "../core/artifacts.js";
import { SafeExitError } from "../core/errors.js";
import { RunRecord } from "../core/state.js";
import { pathExists } from "../utils/fs.js";
import { readJsonFile } from "../utils/json.js";
import { readRenderPlanEvidence } from "./renderPlan.js";
import { renderMediaProbeSchema, type RenderMediaProbe } from "./renderProbe.js";
import { assetRefSchema, digestSchema } from "./renderPlanSchemas.js";
import {
  sourceFrameCadence,
  sourceFrameCount,
  sourceFrameSegments,
} from "./renderTimelineSummary.js";
import { readVoiceoverAudioEvidence } from "./voiceoverEvidence.js";

export const draftRenderPath = "production/render/draft.mp4";
export const draftRenderManifestPath = "production/render/render_manifest.json";
export const draftRenderReviewPath = "production/render/draft_review.md";
export const draftRenderArtifactPaths = [
  draftRenderPath,
  draftRenderManifestPath,
  draftRenderReviewPath,
] as const;

const renderCompositionOverlaySchema = z.strictObject({
  role: z.string().min(1),
  path: z.string().min(1),
  digest: digestSchema,
  placement: z.string().min(1),
});
const voiceoverModeSchema = z.enum(["deterministic-local", "local-piper"]);
const voiceoverQualitySchema = z.enum(["deterministic-local-reference", "local-piper"]);
const renderApprovalSchema = z.strictObject({
  approvalId: z.string().min(1),
  approvedRef: digestSchema,
});
const renderTimelineItemSchema = z
  .strictObject({
    segment: z.enum(["intro", "scene", "outro"]).optional(),
    sceneIndex: z.int().positive().optional(),
    durationSeconds: z.number().positive(),
    backgroundAsset: assetRefSchema,
    sourceFrameAssets: z.array(assetRefSchema).min(1).optional(),
  })
  .refine(
    (item) => item.segment === "intro" || item.segment === "outro" || item.sceneIndex !== undefined,
    {
      message: "Scene timeline items must include a scene index.",
    },
  );
const ffmpegTimelineInputSchema = z.strictObject({
  segment: z.enum(["intro", "scene", "outro"]),
  sceneIndex: z.int().positive().optional(),
  durationSeconds: z.number().positive(),
  asset: assetRefSchema,
  source: z.enum(["background", "source-frame"]),
  frameIndex: z.int().positive().optional(),
});

export const draftRenderManifestSchema = z.strictObject({
  schemaVersion: z.literal(6),
  runId: z.string().min(1),
  createdAt: z.iso.datetime(),
  renderPlan: z.strictObject({
    path: z.literal("production/render_plan.json"),
    digest: digestSchema,
  }),
  voiceoverAudio: z.strictObject({
    path: z.literal("production/audio/voiceover.wav"),
    digest: digestSchema,
    mode: voiceoverModeSchema,
    productionVoiceCandidate: z.boolean(),
    quality: voiceoverQualitySchema,
  }),
  renderApproval: renderApprovalSchema,
  timeline: z.array(renderTimelineItemSchema).min(1),
  ffmpegTimelineInputs: z.array(ffmpegTimelineInputSchema).min(1),
  composition: z.strictObject({
    overlays: z.array(renderCompositionOverlaySchema),
    reviewChecklist: z.array(z.string().min(1)),
  }),
  output: z.strictObject({
    path: z.literal(draftRenderPath),
    sha256: digestSchema,
    bytes: z.int().positive(),
    durationSeconds: z.number().positive(),
  }),
  ffmpeg: z.strictObject({
    binary: z.string().min(1),
    args: z.array(z.string()),
    reviewArgs: z.array(z.string()),
    reviewCommand: z.string().min(1),
  }),
  mediaProbe: renderMediaProbeSchema,
});

export type DraftRenderManifest = z.infer<typeof draftRenderManifestSchema>;

export type DraftRenderEvidence =
  | { status: "missing"; requiredArtifacts: readonly string[] }
  | {
      status: "pass";
      path: string;
      digest: string;
      bytes: number;
      durationSeconds: number;
      overlayRoles: string[];
      timelineSegments: string[];
      sourceFrameCount: number;
      sourceFrameSegments: string[];
      sourceFrameCadence: string[];
      reviewPath: string;
      reviewChecklist: string[];
      voiceoverMode: z.infer<typeof voiceoverModeSchema>;
      voiceoverProductionVoiceCandidate: boolean;
      voiceoverQuality: z.infer<typeof voiceoverQualitySchema>;
      renderApproval: z.infer<typeof renderApprovalSchema>;
      mediaProbe: RenderMediaProbe;
    }
  | { status: "block"; path: string; message: string };

/**
 * Reads and validates draft render evidence for a run.
 *
 * @param run - The run record whose draft render artifacts should be checked
 * @returns A draft render evidence result describing whether the draft render is missing, valid, or blocked by a validation failure
 */
export async function readDraftRenderEvidence(run: RunRecord): Promise<DraftRenderEvidence> {
  const registered = draftRenderArtifactPaths.some((relativePath) =>
    run.artifacts.includes(relativePath),
  );
  const exists = await Promise.all(
    draftRenderArtifactPaths.map((relativePath) =>
      pathExists(artifactPath(run.runId, relativePath)),
    ),
  );
  if (!registered && exists.every((item) => !item)) {
    return { status: "missing", requiredArtifacts: draftRenderArtifactPaths };
  }
  try {
    await assertDraftRenderArtifacts(run);
    const manifest = draftRenderManifestSchema.parse(
      await readJsonFile(artifactPath(run.runId, draftRenderManifestPath)),
    );
    if (manifest.runId !== run.runId) {
      throw new SafeExitError("Draft render manifest run id does not match this run.");
    }
    const output = await readFile(artifactPath(run.runId, draftRenderPath));
    const digest = createHash("sha256").update(output).digest("hex");
    const info = await stat(artifactPath(run.runId, draftRenderPath));
    if (digest !== manifest.output.sha256 || info.size !== manifest.output.bytes) {
      throw new SafeExitError("Draft render output does not match manifest.");
    }
    const renderPlan = await readRenderPlanEvidence(run);
    const voiceoverAudio = await readVoiceoverAudioEvidence(run);
    if (renderPlan.status !== "pass" || renderPlan.digest !== manifest.renderPlan.digest) {
      throw new SafeExitError("Draft render was generated from a stale or missing render plan.");
    }
    if (
      voiceoverAudio.status !== "pass" ||
      voiceoverAudio.digest !== manifest.voiceoverAudio.digest ||
      voiceoverAudio.mode !== manifest.voiceoverAudio.mode ||
      voiceoverAudio.quality !== manifest.voiceoverAudio.quality ||
      voiceoverAudio.productionVoiceCandidate !== manifest.voiceoverAudio.productionVoiceCandidate
    ) {
      throw new SafeExitError("Draft render was generated from stale or missing voiceover audio.");
    }
    const approval = run.approvals.find((item) => item.target === "render");
    if (
      !approval ||
      approval.approvalId !== manifest.renderApproval.approvalId ||
      approval.approvedRef !== manifest.renderApproval.approvedRef
    ) {
      throw new SafeExitError("Draft render approval record changed after render.");
    }
    return {
      status: "pass",
      path: draftRenderPath,
      digest,
      bytes: manifest.output.bytes,
      durationSeconds: manifest.output.durationSeconds,
      overlayRoles: manifest.composition.overlays.map((overlay) => overlay.role),
      timelineSegments: manifest.timeline.map((item) => item.segment ?? "scene"),
      sourceFrameCount: sourceFrameCount(manifest.timeline),
      sourceFrameSegments: sourceFrameSegments(manifest.timeline),
      sourceFrameCadence: sourceFrameCadence(manifest.ffmpegTimelineInputs),
      reviewPath: draftRenderReviewPath,
      reviewChecklist: manifest.composition.reviewChecklist,
      voiceoverMode: manifest.voiceoverAudio.mode,
      voiceoverProductionVoiceCandidate: manifest.voiceoverAudio.productionVoiceCandidate,
      voiceoverQuality: manifest.voiceoverAudio.quality,
      renderApproval: manifest.renderApproval,
      mediaProbe: manifest.mediaProbe,
    };
  } catch (error) {
    return {
      status: "block",
      path: draftRenderPath,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Verifies that all draft render artifacts are registered and present on disk.
 *
 * @param run - The run record whose draft render artifacts are checked
 */
async function assertDraftRenderArtifacts(run: RunRecord): Promise<void> {
  for (const relativePath of draftRenderArtifactPaths) {
    if (!run.artifacts.includes(relativePath)) {
      throw new SafeExitError(`Draft render artifact is not registered: ${relativePath}.`);
    }
    if (!(await pathExists(artifactPath(run.runId, relativePath)))) {
      throw new SafeExitError(`Draft render artifact is missing: ${relativePath}.`);
    }
  }
}
