import { z } from "zod";
import { isValidRunId } from "../core/runId.js";
import {
  soundtrackAssetSchema,
  soundtrackManifestSchema,
} from "../stages/soundtrack/soundtrackManifest.js";

const runIdSchema = z.string().refine(isValidRunId, { message: "Invalid run id." });
const digestSchema = z.string().regex(/^[a-f0-9]{64}$/, "Expected a SHA-256 digest.");
const revisionSchema = z.int().positive();
const expectationShape = {
  expectedManifestDigest: digestSchema,
  expectedRevision: revisionSchema,
} as const;
const sourceFileNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(240)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._ -]*$/, "Soundtrack source file name is unsafe.");
const audioBase64Schema = z
  .string()
  .min(4)
  .max(69_905_068)
  .refine((value) => value.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(value), {
    message: "Soundtrack import content must be canonical base64.",
  });

export const soundtrackPrepareRequestSchema = z.strictObject({ runId: runIdSchema });
export const soundtrackImportRequestSchema = z.strictObject({
  assetId: soundtrackAssetSchema.shape.assetId,
  contentBase64: audioBase64Schema,
  ...expectationShape,
  provenance: soundtrackAssetSchema.shape.provenance,
  role: soundtrackAssetSchema.shape.role,
  runId: runIdSchema,
  sourceFileName: sourceFileNameSchema,
});
export const soundtrackConfigureRequestSchema = z.strictObject({
  ...expectationShape,
  music: soundtrackManifestSchema.shape.music,
  runId: runIdSchema,
  sfx: soundtrackManifestSchema.shape.sfx,
});
export const soundtrackAnalyzeRequestSchema = z.strictObject({
  ...expectationShape,
  runId: runIdSchema,
});
export const soundtrackDecisionRequestSchema = z.strictObject({
  ...expectationShape,
  notes: z.string().trim().min(1).max(4_000),
  reviewedBy: z.string().trim().min(1).max(200),
  runId: runIdSchema,
  status: z.enum(["approved", "rejected"]),
});
