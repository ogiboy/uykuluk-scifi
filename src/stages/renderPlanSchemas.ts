import { z } from "zod";
import { productionPackageManifestPath } from "./productionPackageIntegrity.js";

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
export const renderPlanSchema = z.strictObject({
  schemaVersion: z.literal(1),
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
  scenes: z.array(
    z.strictObject({
      sceneIndex: z.int().positive(),
      narrationPreview: z.string().min(1),
      durationSeconds: z.number().positive(),
      visualPrompt: z.string().min(1),
      backgroundAsset: assetRefSchema,
      overlayAssets: z.array(assetRefSchema),
      subtitleSource: z.literal("production/subtitles.srt"),
      voiceoverSource: z.literal("production/voiceover.txt"),
    }),
  ),
});
export const assetProvenanceSchema = z.strictObject({
  schemaVersion: z.literal(1),
  runId: z.string().min(1),
  createdAt: z.iso.datetime(),
  assets: z.array(assetRefSchema),
});

export type AssetRef = z.infer<typeof assetRefSchema>;
export type RenderPlan = z.infer<typeof renderPlanSchema>;
export type AssetProvenance = z.infer<typeof assetProvenanceSchema>;
