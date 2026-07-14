import { z } from "zod";
import { activeVoiceSubtitleDescriptorSchema } from "../voice/voiceoverSubtitles.js";
import { assetRefSchema, digestSchema } from "./renderPlanSchemas.js";
import { renderMediaProbeSchema, type RenderMediaProbe } from "./renderProbe.js";

export const draftRenderPath = "production/render/draft.mp4";
export const draftRenderManifestPath = "production/render/render_manifest.json";
export const draftRenderReviewPath = "production/render/draft_review.md";
export const draftRenderChaptersJsonPath = "production/render/youtube_chapters.json";
export const draftRenderChaptersMarkdownPath = "production/render/youtube_chapters.md";
export const draftRenderArtifactPaths = [
  draftRenderPath,
  draftRenderManifestPath,
  draftRenderReviewPath,
  draftRenderChaptersJsonPath,
  draftRenderChaptersMarkdownPath,
] as const;

const renderCompositionOverlaySchema = z.strictObject({
  role: z.string().min(1),
  path: z.string().min(1),
  digest: digestSchema,
  placement: z.string().min(1),
});
const voiceoverModeSchema = z.enum(["deterministic-local", "local-piper", "elevenlabs"]);
const voiceoverQualitySchema = z.enum([
  "deterministic-local-reference",
  "local-piper",
  "elevenlabs",
]);
const renderApprovalSchema = z.strictObject({
  approvalId: z.string().min(1),
  approvedRef: digestSchema,
});
const renderTimelineItemSchema = z
  .strictObject({
    segment: z.enum(["intro", "scene", "outro"]),
    sceneIndex: z.int().positive().optional(),
    durationSeconds: z.number().positive(),
    backgroundAsset: assetRefSchema,
    sourceFrameAssets: z.array(assetRefSchema).min(1).optional(),
  })
  .refine(
    (item) => item.segment === "intro" || item.segment === "outro" || item.sceneIndex !== undefined,
    { message: "Scene timeline items must include a scene index." },
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
  schemaVersion: z.literal(9),
  runId: z.string().min(1),
  createdAt: z.iso.datetime(),
  renderPlan: z.strictObject({
    path: z.literal("production/render_plan.json"),
    digest: digestSchema,
  }),
  voiceoverAudio: z.strictObject({
    path: z.literal("production/audio/voiceover.wav"),
    digest: digestSchema,
    metadataDigest: digestSchema,
    mode: voiceoverModeSchema,
    productionVoiceCandidate: z.boolean(),
    quality: voiceoverQualitySchema,
  }),
  subtitles: activeVoiceSubtitleDescriptorSchema,
  renderApproval: renderApprovalSchema,
  timeline: z.array(renderTimelineItemSchema).min(1),
  timing: z.strictObject({
    introDurationSeconds: z.number().nonnegative(),
    sceneAudioDurationSeconds: z.number().positive(),
    outroDurationSeconds: z.number().nonnegative(),
    totalDurationSeconds: z.number().positive(),
  }),
  subtitleTiming: z.discriminatedUnion("timingMode", [
    z.strictObject({
      timingMode: z.literal("linear-fallback"),
      sourceDurationSeconds: z.number().positive(),
      sceneDurationSeconds: z.number().positive(),
      timeScale: z.number().positive(),
    }),
    z.strictObject({
      timingMode: z.literal("elevenlabs-character-aligned"),
      sourceDurationSeconds: z.number().positive(),
      sceneDurationSeconds: z.number().positive(),
      timeScale: z.literal(1),
    }),
  ]),
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
  chapterDraft: z.strictObject({
    jsonPath: z.literal(draftRenderChaptersJsonPath),
    markdownPath: z.literal(draftRenderChaptersMarkdownPath),
    jsonSha256: digestSchema,
    markdownSha256: digestSchema,
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
      ffmpegReviewCommand: string;
      voiceoverMode: z.infer<typeof voiceoverModeSchema>;
      voiceoverProductionVoiceCandidate: boolean;
      voiceoverQuality: z.infer<typeof voiceoverQualitySchema>;
      subtitlePath: string;
      subtitleTimingMode: z.infer<typeof activeVoiceSubtitleDescriptorSchema>["timingMode"];
      renderApproval: z.infer<typeof renderApprovalSchema>;
      mediaProbe: RenderMediaProbe;
    }
  | { status: "block"; path: string; message: string };
