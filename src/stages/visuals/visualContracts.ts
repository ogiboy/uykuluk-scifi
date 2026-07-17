import { z } from "zod";
import { isValidArtifactRelativePath } from "../../core/artifactPaths.js";
import { digestSchema } from "../render/renderPlanSchemas.js";
import { visualMotionPresetSchema } from "./visualMotionContracts.js";

export { visualMotionPresetSchema } from "./visualMotionContracts.js";
export type { VisualMotionPreset } from "./visualMotionContracts.js";

export const visualManifestPath = "production/visuals/manifest.json";
export const visualContactSheetPath = "production/visuals/contact_sheet.md";
export const visualArtifactPaths = [visualManifestPath, visualContactSheetPath] as const;

const canonicalPathSchema = z
  .string()
  .min(1)
  .refine(isValidArtifactRelativePath, "Expected a canonical relative artifact path.");

const visualAssetSchema = z.strictObject({
  role: z.literal("scene-visual"),
  path: canonicalPathSchema,
  digest: digestSchema,
});

const visualMediaSchema = z.strictObject({
  bytes: z.int().positive(),
  format: z.enum(["jpeg", "png"]),
  height: z.int().positive(),
  width: z.int().positive(),
});

export const hostedVisualSourceSchema = z.strictObject({
  kind: z.literal("hosted-generation"),
  service: z.literal("black-forest-labs"),
  modelId: z.literal("flux-2-pro"),
  operationId: z.string().regex(/^image_[a-f0-9]{64}$/),
  planDigest: digestSchema,
  quoteDigest: digestSchema,
  approvalId: z.string().min(1).max(200),
  reservationId: z.string().min(1).max(200),
  resultSpool: z.strictObject({ path: canonicalPathSchema, digest: digestSchema }),
  providerRequestIdHash: digestSchema,
  billableCredits: z.number().nonnegative(),
  actualUsdMicros: z.int().nonnegative(),
});

const visualSourceSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("static-fallback"),
    sourceAssetDigest: digestSchema,
    sourceAssetPath: canonicalPathSchema,
  }),
  z.strictObject({
    kind: z.literal("manual-import"),
    originalFileName: z.string().min(1).max(240),
    sourceDigest: digestSchema,
  }),
  hostedVisualSourceSchema,
]);

export const visualRevisionSchema = z
  .strictObject({
    revision: z.int().positive(),
    provider: z.enum(["static", "manual-import", "black-forest-labs"]),
    createdAt: z.iso.datetime(),
    asset: visualAssetSchema,
    media: visualMediaSchema.optional(),
    motion: visualMotionPresetSchema,
    source: visualSourceSchema,
  })
  .superRefine((revision, context) => {
    const providerBySource = {
      "static-fallback": "static",
      "manual-import": "manual-import",
      "hosted-generation": "black-forest-labs",
    } as const;
    if (revision.provider !== providerBySource[revision.source.kind]) {
      context.addIssue({
        code: "custom",
        message: "Visual revision provider does not match its source kind.",
        path: ["provider"],
      });
    }
  });

export const visualDecisionSchema = z.strictObject({
  revision: z.int().positive(),
  status: z.enum(["approved", "rejected"]),
  reviewedBy: z.string().trim().min(1).max(200),
  notes: z.string().trim().min(1).max(4_000),
  decidedAt: z.iso.datetime(),
});

const visualSceneSchema = z
  .strictObject({
    sceneIndex: z.int().positive(),
    productionSceneIndexes: z.array(z.int().positive()).min(1),
    durationSeconds: z.number().positive(),
    visualPrompt: z.string().min(1),
    promptDigest: digestSchema,
    activeRevision: z.int().positive(),
    revisions: z.array(visualRevisionSchema).min(1),
    decision: visualDecisionSchema.optional(),
  })
  .superRefine((scene, context) => {
    if (!scene.revisions.some((revision) => revision.revision === scene.activeRevision)) {
      context.addIssue({
        code: "custom",
        message: "Active visual revision is missing from scene history.",
        path: ["activeRevision"],
      });
    }
    if (scene.decision && scene.decision.revision !== scene.activeRevision) {
      context.addIssue({
        code: "custom",
        message: "Visual decision must target the active revision.",
        path: ["decision", "revision"],
      });
    }
  });

export const visualManifestSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    runId: z.string().min(1),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    productionPackage: z.strictObject({
      path: z.literal("production/production_package.meta.json"),
      digest: digestSchema,
    }),
    scenes: z.array(visualSceneSchema).min(12).max(24),
  })
  .superRefine((manifest, context) => {
    const sceneIndexes = manifest.scenes.map((scene) => scene.sceneIndex);
    if (new Set(sceneIndexes).size !== sceneIndexes.length) {
      context.addIssue({ code: "custom", message: "Visual scene indexes must be unique." });
    }
    if (sceneIndexes.some((sceneIndex, index) => sceneIndex !== index + 1)) {
      context.addIssue({
        code: "custom",
        message: "Visual scene indexes must be contiguous and start at 1.",
      });
    }
  });

export type VisualManifest = z.infer<typeof visualManifestSchema>;
export type VisualScene = VisualManifest["scenes"][number];
export type VisualRevision = z.infer<typeof visualRevisionSchema>;
export type VisualDecision = z.infer<typeof visualDecisionSchema>;
export type VisualMedia = z.infer<typeof visualMediaSchema>;

export type VisualManifestEvidence =
  | { status: "missing"; requiredArtifacts: readonly string[] }
  | {
      status: "pass";
      path: typeof visualManifestPath;
      digest: string;
      approvedSceneCount: number;
      sceneCount: number;
      manifest: VisualManifest;
    }
  | { status: "block"; path: typeof visualManifestPath; message: string };
