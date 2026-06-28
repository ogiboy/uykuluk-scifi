import { z } from "zod";

type EvidenceStatus = {
  [key: string]: unknown;
};

export type EvidenceStatusValidationResult =
  | { evidence: EvidenceStatus; kind: "present" }
  | { kind: "missing" }
  | { kind: "invalid"; message: string }
  | { kind: "stale"; message: string };

const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);

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
  mode: z.enum(["deterministic-local", "local-piper"]),
  productionVoiceCandidate: z.boolean(),
  quality: z.enum(["deterministic-local-reference", "local-piper"]),
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
  reviewPath: z.string().min(1),
  reviewChecklist: z.array(z.string()),
  voiceoverMode: z.enum(["deterministic-local", "local-piper"]),
  voiceoverProductionVoiceCandidate: z.boolean(),
  voiceoverQuality: z.enum(["deterministic-local-reference", "local-piper"]),
  mediaProbe: mediaProbeSchema,
});

const persistedEvidenceStatusSchema = z.looseObject({
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
});

/**
 * Validates a persisted evidence bundle snapshot for status and Studio reads.
 *
 * @param evidence - Parsed evidence data to validate.
 * @param runId - Expected run identifier.
 * @param currentState - Expected run state.
 * @returns A present, stale, or invalid evidence classification.
 */
export function validateEvidenceStatusSnapshot(
  evidence: unknown,
  runId: string,
  currentState: string,
): EvidenceStatusValidationResult {
  const parsed = persistedEvidenceStatusSchema.safeParse(evidence);
  if (!parsed.success) {
    return { kind: "invalid", message: "evidence_bundle.json is missing required fields." };
  }
  if (parsed.data.runId !== runId) {
    return { kind: "stale", message: "evidence_bundle.json belongs to a different run." };
  }
  if (parsed.data.currentState !== currentState) {
    return {
      kind: "stale",
      message: `evidence_bundle.json was generated for ${String(
        parsed.data.currentState,
      )}, but the run is ${currentState}.`,
    };
  }
  return { evidence: parsed.data as EvidenceStatus, kind: "present" };
}
