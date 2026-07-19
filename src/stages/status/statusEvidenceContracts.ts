import { z } from "zod";

import {
  isVoiceSelectionArtifactPath,
  voicePreviewAudioArtifactPathSchema,
  voicePreviewEvidenceArtifactPathSchema,
} from "../voice/catalog/voiceAuditionContracts.js";
import {
  voiceCandidatesArtifactPathSchema,
  voiceCandidatesPath,
} from "../voice/catalog/voiceCatalogContracts.js";

const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);
const selectedVoiceArtifactPathsSchema = z.strictObject({
  catalog: z.union([z.literal(voiceCandidatesPath), voiceCandidatesArtifactPathSchema]),
  previewEvidence: z.union([
    z.string().regex(/^production\/audio\/previews\/[A-Za-z0-9._-]{1,128}\.json$/),
    voicePreviewEvidenceArtifactPathSchema,
  ]),
  previewAudio: z.union([
    z.string().regex(/^production\/audio\/previews\/[A-Za-z0-9._-]{1,128}\.(mp3|wav)$/),
    voicePreviewAudioArtifactPathSchema,
  ]),
  selection: z.string().min(1).refine(isVoiceSelectionArtifactPath),
});

const evidenceRunStateSchema = z.enum([
  "NEW",
  "IDEAS_GENERATED",
  "IDEA_APPROVED",
  "SCRIPT_GENERATED",
  "SCRIPT_REVIEWED",
  "SCRIPT_APPROVED",
  "PRODUCTION_PACKAGE_GENERATED",
  "COST_ESTIMATED",
  "PAID_GENERATION_COST_APPROVED",
  "READY_FOR_MANUAL_PRODUCTION",
  "RENDER_APPROVED",
  "RENDERED",
  "UPLOAD_APPROVED",
  "UPLOADED_PRIVATE",
  "PUBLISH_APPROVED",
  "SCHEDULED_OR_PUBLIC",
  "ARCHIVED",
  "FAILED",
]);

const mediaProbeSchema = z.strictObject({
  binary: z.string().min(1),
  durationSeconds: z.number().positive(),
  formatName: z.string().min(1).optional(),
  video: z.strictObject({
    codecName: z.string().min(1).optional(),
    width: z.int().positive(),
    height: z.int().positive(),
  }),
  audio: z.strictObject({
    channels: z.int().positive().optional(),
    codecName: z.string().min(1).optional(),
    sampleRateHz: z.int().positive().optional(),
  }),
});

const missingMediaSchema = z.strictObject({
  status: z.literal("missing"),
  requiredArtifacts: z.array(z.string().min(1)).min(1),
});

const blockedMediaSchema = z.looseObject({
  status: z.literal("block"),
  path: z.string().min(1),
  message: z.string().min(1),
});

const renderPlanPassSchema = z.looseObject({
  status: z.literal("pass"),
  path: z.string().min(1),
  digest: digestSchema,
  artifactCount: z.int().nonnegative(),
  assetCount: z.int().nonnegative(),
});

const voiceoverPassSchema = z.looseObject({
  status: z.literal("pass"),
  path: z.string().min(1),
  digest: digestSchema,
  durationSeconds: z.number().positive(),
  localPlaybackPath: z.string().min(1),
  mode: z.enum(["deterministic-local", "local-piper", "elevenlabs"]),
  productionVoiceCandidate: z.boolean(),
  quality: z.enum(["deterministic-local-reference", "local-piper", "elevenlabs"]),
  reviewPath: z.string().min(1),
  sourceWordCount: z.int().positive(),
});

const draftRenderPassSchema = z.looseObject({
  status: z.literal("pass"),
  path: z.string().min(1),
  digest: digestSchema,
  bytes: z.int().positive(),
  durationSeconds: z.number().positive(),
  overlayRoles: z.array(z.string()),
  timelineSegments: z.array(z.string().min(1)).min(1),
  sourceFrameCount: z.int().nonnegative(),
  sourceFrameSegments: z.array(z.string()),
  sourceFrameCadence: z.array(z.string()),
  reviewPath: z.string().min(1),
  reviewChecklist: z.array(z.string()),
  ffmpegReviewCommand: z.string().min(1),
  voiceoverMode: z.enum(["deterministic-local", "local-piper", "elevenlabs"]),
  voiceoverProductionVoiceCandidate: z.boolean(),
  voiceoverQuality: z.enum(["deterministic-local-reference", "local-piper", "elevenlabs"]),
  renderApproval: z.strictObject({
    approvalId: z.string().min(1),
    approvedRef: digestSchema,
    contractVersion: z.literal(4).optional(),
  }),
  mediaProbe: mediaProbeSchema,
});

export const persistedEvidenceStatusSchema = z
  .looseObject({
    schemaVersion: z.literal(1),
    runId: z.string().min(1),
    generatedAt: z.iso.datetime(),
    currentState: evidenceRunStateSchema,
    approvals: z.array(z.unknown()),
    costs: z.array(z.unknown()),
    costReservations: z.array(z.unknown()),
    productionPackageIntegrity: z.unknown(),
    renderPlan: z.discriminatedUnion("status", [
      missingMediaSchema,
      blockedMediaSchema,
      renderPlanPassSchema,
    ]),
    voiceoverAudio: z.discriminatedUnion("status", [
      missingMediaSchema,
      blockedMediaSchema,
      voiceoverPassSchema,
    ]),
    voiceSelection: z.discriminatedUnion("status", [
      z.strictObject({ status: z.literal("not-required") }),
      z.strictObject({ status: z.literal("missing-or-invalid") }),
      z.strictObject({
        status: z.literal("current"),
        path: z.string().min(1).refine(isVoiceSelectionArtifactPath),
        digest: digestSchema,
        validUntil: z.iso.datetime(),
        artifacts: selectedVoiceArtifactPathsSchema,
      }),
    ]),
    voiceAuditionPathRevision: digestSchema,
    voiceAuditionRevision: digestSchema.nullable(),
    ttsConfigurationDigest: digestSchema,
    draftRender: z.discriminatedUnion("status", [
      missingMediaSchema,
      blockedMediaSchema,
      draftRenderPassSchema,
    ]),
    generatedArtifacts: z.array(z.string()),
    warnings: z.array(z.string()),
    promptProvenance: z.array(z.unknown()),
    revisions: z.array(z.string()),
    blockedActions: z.array(z.unknown()),
    nextRecommendedCommand: z.string().min(1),
    ledgerEventCount: z.int().nonnegative(),
  })
  .superRefine((evidence, context) => {
    const hasSelection = evidence.voiceSelection.status === "current";
    if (hasSelection !== (evidence.voiceAuditionRevision !== null)) {
      context.addIssue({
        code: "custom",
        message: "Voice audition revision does not match selection status.",
        path: ["voiceAuditionRevision"],
      });
    }
    if (
      evidence.voiceSelection.status === "current" &&
      evidence.voiceSelection.artifacts.selection !== evidence.voiceSelection.path
    ) {
      context.addIssue({
        code: "custom",
        message: "Voice selection path is missing from its audition binding.",
        path: ["voiceSelection", "artifacts", "selection"],
      });
    }
    if (
      evidence.voiceSelection.status === "current" &&
      new Set(Object.values(evidence.voiceSelection.artifacts)).size !== 4
    ) {
      context.addIssue({
        code: "custom",
        message: "Voice audition binding must contain four distinct artifacts.",
        path: ["voiceSelection", "artifacts"],
      });
    }
  });

export type PersistedEvidenceStatus = z.infer<typeof persistedEvidenceStatusSchema>;
