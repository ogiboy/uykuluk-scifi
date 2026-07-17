import { z } from "zod";
import { digestSchema } from "../render/renderPlanSchemas.js";

export const hostedVisualGenerationPlanPath = "production/visuals/generation_plan.json";

const positiveUsdSchema = z.number().positive().max(2_400);

export const hostedVisualGenerationPlanSchema = z.strictObject({
  schemaVersion: z.literal(1),
  runId: z.string().min(1),
  createdAt: z.iso.datetime(),
  productionPackage: z.strictObject({
    path: z.literal("production/production_package.meta.json"),
    digest: digestSchema,
  }),
  visualManifest: z.strictObject({
    path: z.literal("production/visuals/manifest.json"),
    digest: digestSchema,
  }),
  purpose: z.enum(["initial", "regenerate-rejected"]),
  targetedSceneIndexes: z.array(z.int().positive()).min(1).max(24),
  provider: z.literal("black-forest-labs"),
  model: z.literal("flux-2-pro"),
  settings: z.strictObject({
    endpoint: z.literal("https://api.bfl.ai/v1/flux-2-pro"),
    width: z.int().min(64).max(8_192),
    height: z.int().min(64).max(8_192),
    outputFormat: z.enum(["jpeg", "png"]),
    safetyTolerance: z.int().min(0).max(5),
    timeoutMs: z.int().min(1_000).max(600_000),
    pollIntervalMs: z.int().min(250).max(10_000),
    maxPollAttempts: z.int().positive().max(2_400),
  }),
  pricing: z.strictObject({
    source: z.literal("configured-snapshot"),
    snapshotId: z.string().min(1).max(128),
    usdPerMegapixel: z.number().positive().max(100),
    usdPerCredit: z.literal(0.01),
    estimatedUsdPerImage: positiveUsdSchema,
    maximumUsdPerImage: positiveUsdSchema,
    digest: digestSchema,
  }),
  scenes: z
    .array(
      z.strictObject({
        sceneIndex: z.int().positive(),
        prompt: z.string().min(1),
        promptDigest: digestSchema,
        activeRevision: z.int().positive(),
        activeRevisionDigest: digestSchema,
        seed: z.int().nonnegative().max(4_294_967_295),
        maximumUsd: positiveUsdSchema,
      }),
    )
    .min(1)
    .max(24),
  totalMaximumUsd: positiveUsdSchema,
  bindingDigest: digestSchema,
});

export type HostedVisualGenerationPlan = z.infer<typeof hostedVisualGenerationPlanSchema>;
