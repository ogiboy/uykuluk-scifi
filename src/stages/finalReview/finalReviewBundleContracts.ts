import { z } from "zod";

/** Persisted contracts for the local final-review handoff bundle. */

export const finalReviewBundleJsonPath = "production/review_bundle.json";
export const finalReviewBundleMarkdownPath = "production/review_bundle.md";

export function finalReviewBundleCommand(runId: string): string {
  return `pnpm producer review-bundle --run ${runId}`;
}

const finalReviewBundleStatusValues = [
  "decision-pending",
  "accepted-for-local-review",
  "needs-revision",
  "rejected",
] as const;

const finalReviewArtifactSchema = z.strictObject({
  label: z.string().min(1),
  operatorAction: z.string().min(1),
  path: z.string().min(1),
  reviewPhase: z.string().min(1),
});

const draftRenderChapterBindingSchema = z.strictObject({
  jsonPath: z.string().min(1),
  markdownPath: z.string().min(1),
  jsonSha256: z.string().regex(/^[a-f0-9]{64}$/),
  markdownSha256: z.string().regex(/^[a-f0-9]{64}$/),
});

const finalReviewBundleV1Schema = z.looseObject({
  schemaVersion: z.literal(1),
  draftRender: z.looseObject({ chapters: z.undefined().optional() }),
});

export const finalReviewBundleV2Schema = z.strictObject({
  schemaVersion: z.literal(2),
  runId: z.string().min(1),
  createdAt: z.iso.datetime(),
  status: z.enum(finalReviewBundleStatusValues),
  summary: z.string().min(1),
  renderPlan: z.strictObject({
    path: z.string().min(1),
    contactSheetPath: z.string().min(1),
    assetProvenancePath: z.string().min(1),
    sceneCount: z.int().nonnegative(),
    estimatedDraftDurationSeconds: z.number().positive(),
  }),
  voiceover: z.strictObject({
    path: z.string().min(1),
    mode: z.string().min(1),
    quality: z.string().min(1),
    productionVoiceCandidate: z.boolean(),
    reviewPath: z.string().min(1),
    renderApprovalScope: z.string().min(1),
  }),
  draftRender: z.strictObject({
    path: z.string().min(1),
    reviewPath: z.string().min(1),
    manifestPath: z.string().min(1),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    durationSeconds: z.number().positive(),
    reviewCommand: z.string().min(1),
    chapters: draftRenderChapterBindingSchema,
    media: z.strictObject({
      audioCodec: z.string().min(1),
      videoCodec: z.string().min(1),
      width: z.int().positive(),
      height: z.int().positive(),
    }),
  }),
  renderDecision: z.discriminatedUnion("kind", [
    z.strictObject({
      kind: z.literal("missing"),
      nextAction: z.string().min(1),
      commandTemplates: z.array(
        z.strictObject({
          command: z.string().min(1),
          decision: z.enum(["accepted-for-local-review", "needs-revision", "rejected"]),
          guidance: z.string().min(1),
        }),
      ),
    }),
    z.strictObject({
      kind: z.literal("present"),
      decision: z.enum(["accepted-for-local-review", "needs-revision", "rejected"]),
      reviewedBy: z.string().min(1),
      createdAt: z.iso.datetime(),
      notes: z.string().min(1),
      reviewCommand: z.string().min(1),
      nextSafeAction: z.string().min(1),
    }),
  ]),
  artifacts: z.array(finalReviewArtifactSchema).min(1),
  nextSafeAction: z.string().min(1),
  blockedActions: z.array(z.string().min(1)),
});

const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);

const finalReviewBundleV3MediaSchema = z.strictObject({
  soundtrack: z.strictObject({
    manifestPath: z.literal("production/audio/soundtrack/manifest.json"),
    manifestDigest: digestSchema,
    mode: z.enum(["voice-only", "mixed"]),
    revision: z.int().positive(),
    decision: z.strictObject({ status: z.literal("approved"), decidedAt: z.iso.datetime() }),
  }),
  rightsProvenance: z.strictObject({
    assetCount: z.int().nonnegative(),
    musicAssetCount: z.int().nonnegative(),
    sfxAssetCount: z.int().nonnegative(),
    rightsBases: z.array(
      z.strictObject({
        basis: z.enum(["owned", "licensed", "public-domain", "permission-granted"]),
        assetCount: z.int().positive(),
      }),
    ),
  }),
  mastering: z.strictObject({
    evidencePath: z.literal("production/render/audio_mastering.json"),
    evidenceSha256: digestSchema,
    target: z.strictObject({
      integratedLufs: z.literal(-14),
      toleranceLufs: z.literal(1),
      normalizationTruePeakDbtp: z.literal(-1.5),
      maxOutputTruePeakDbtp: z.literal(-1),
      loudnessRangeLufs: z.literal(11),
    }),
    output: z.strictObject({
      integratedLufs: z.number(),
      truePeakDbtp: z.number(),
      loudnessRangeLufs: z.number().nonnegative(),
    }),
    passed: z.literal(true),
  }),
  encoding: z.strictObject({
    container: z.literal("mp4"),
    videoCodec: z.literal("h264"),
    audioCodec: z.literal("aac"),
    audioSampleRateHz: z.literal(48_000),
    audioChannels: z.literal(2),
  }),
  renderApproval: z.strictObject({
    approvalId: z.string().min(1),
    approvedRef: digestSchema,
    contractVersion: z.literal(4),
  }),
});

export const finalReviewBundleSchema = finalReviewBundleV2Schema.extend({
  schemaVersion: z.literal(3),
  media: finalReviewBundleV3MediaSchema,
});

export type CurrentFinalReviewBundle = z.infer<typeof finalReviewBundleSchema>;
export type FinalReviewBundleV2 = z.infer<typeof finalReviewBundleV2Schema>;
export type FinalReviewBundle = CurrentFinalReviewBundle | FinalReviewBundleV2;

export function isLegacyFinalReviewBundle(value: unknown): boolean {
  return finalReviewBundleV1Schema.safeParse(value).success;
}

export function isV2FinalReviewBundle(value: unknown): boolean {
  return finalReviewBundleV2Schema.safeParse(value).success;
}
