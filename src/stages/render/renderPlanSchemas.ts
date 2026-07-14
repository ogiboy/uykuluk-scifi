import { z } from "zod";
import { productionPackageManifestPath } from "../production/productionPackagePaths.js";
import { visualMotionPresetSchema } from "../visuals/visualMotionContracts.js";

export const renderPlanArtifactPaths = [
  "production/render_plan.json",
  "production/storyboard_contact_sheet.md",
  "production/asset_provenance.json",
] as const;

export const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const assetRefSchema = z.strictObject({
  role: z.string().min(1),
  path: z.string().min(1),
  digest: digestSchema,
});
export const productionSceneSchema = z.strictObject({
  index: z.int().positive(),
  narration: z.string().min(1),
  visualPrompt: z.string().min(1),
  durationSeconds: z.number().positive(),
});
const renderBookendSchema = z.strictObject({
  durationSeconds: z.number().positive(),
  asset: assetRefSchema,
  frameAssets: z.array(assetRefSchema).min(1).optional(),
});
const renderPlanSceneBase = {
  sceneIndex: z.int().positive(),
  narrationPreview: z.string().min(1),
  durationSeconds: z.number().positive(),
  visualPrompt: z.string().min(1),
  popupCardText: z.string().min(1).optional(),
  backgroundAsset: assetRefSchema,
  overlayAssets: z.array(assetRefSchema),
  subtitleSource: z.literal("production/subtitles.srt"),
  voiceoverSource: z.literal("production/voiceover.txt"),
} as const;

const renderPlanBase = {
  runId: z.string().min(1),
  createdAt: z.iso.datetime(),
  productionPackageManifestPath: z.literal(productionPackageManifestPath),
  productionPackageManifestDigest: digestSchema,
  format: z.strictObject({
    resolution: z.literal("1920x1080"),
    fps: z.literal(30),
    aspectRatio: z.literal("16:9"),
    draftRenderer: z.literal("ffmpeg-local-draft"),
  }),
  bookends: z.strictObject({ intro: renderBookendSchema, outro: renderBookendSchema }).optional(),
} as const;

const legacyRenderPlanSchema = z.strictObject({
  schemaVersion: z.literal(1),
  ...renderPlanBase,
  scenes: z.array(z.strictObject(renderPlanSceneBase)).min(1),
});

const visualRenderPlanSchema = z.strictObject({
  schemaVersion: z.literal(2),
  ...renderPlanBase,
  visualManifest: z.strictObject({
    path: z.literal("production/visuals/manifest.json"),
    digest: digestSchema,
  }),
  scenes: z
    .array(
      z.strictObject({
        ...renderPlanSceneBase,
        visualRevision: z.int().positive(),
        motion: visualMotionPresetSchema,
      }),
    )
    .min(1),
});

export const renderPlanSchema = z.discriminatedUnion("schemaVersion", [
  legacyRenderPlanSchema,
  visualRenderPlanSchema,
]);
export const assetProvenanceSchema = z.strictObject({
  schemaVersion: z.literal(1),
  runId: z.string().min(1),
  createdAt: z.iso.datetime(),
  assets: z.array(assetRefSchema),
});

export type AssetRef = z.infer<typeof assetRefSchema>;
export type RenderPlan = z.infer<typeof renderPlanSchema>;
export type AssetProvenance = z.infer<typeof assetProvenanceSchema>;
