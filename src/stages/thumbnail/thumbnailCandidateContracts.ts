import { z } from "zod";
import { digestSchema } from "../render/renderPlanSchemas.js";

export const thumbnailCandidatesJsonPath = "production/thumbnail_candidates.json";
export const thumbnailCandidatesMarkdownPath = "production/thumbnail_candidates.md";

const assetRefSchema = z.strictObject({
  digest: digestSchema,
  path: z.string().min(1),
  role: z.string().min(1),
});

const thumbnailCandidateSchema = z.strictObject({
  id: z.string().min(1),
  reviewFocus: z.string().min(1),
  template: assetRefSchema,
  textSafeOverlay: assetRefSchema.optional(),
});

export const thumbnailCandidatePackSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    runId: z.string().min(1),
    source: z.strictObject({
      finalReviewBundlePath: z.literal("production/review_bundle.json"),
      finalReviewBundleDigest: digestSchema,
    }),
    recommendedCandidateId: z.string().min(1),
    candidates: z.array(thumbnailCandidateSchema).min(1),
    operatorNotes: z.array(z.string().min(1)).min(1),
    blockedActions: z.array(z.string().min(1)).min(1),
  })
  .refine(
    (pack) => pack.candidates.some((candidate) => candidate.id === pack.recommendedCandidateId),
    {
      message: "recommendedCandidateId must match one candidate id.",
      path: ["recommendedCandidateId"],
    },
  );

export type AssetRef = z.infer<typeof assetRefSchema>;
export type ThumbnailCandidatePack = z.infer<typeof thumbnailCandidatePackSchema>;
