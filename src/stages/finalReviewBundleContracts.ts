import { z } from "zod";

export const finalReviewBundleJsonPath = "production/review_bundle.json";
export const finalReviewBundleMarkdownPath = "production/review_bundle.md";

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

export const finalReviewBundleSchema = z.strictObject({
  schemaVersion: z.literal(1),
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

export type FinalReviewBundle = z.infer<typeof finalReviewBundleSchema>;
