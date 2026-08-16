import { z } from "zod";
import { producerConfigSchema } from "../config/schema.js";
import { isValidRunId } from "../core/runId.js";
import { promptProfileSchema } from "../prompts/profiles/promptProfileStore.js";
import { channelHandoffDecisionValues } from "../stages/channel/channelHandoffDecisionContracts.js";
import { renderDecisionValues } from "../stages/render/renderDecisionCommands.js";
import { voiceSelectionInputSchema } from "../stages/voice/catalog/voiceAuditionContracts.js";
import { voiceIdSchema } from "../stages/voice/catalog/voiceCatalogContracts.js";
import {
  hasUnsafeControlCharacters,
  hasUnsafeNotesControlCharacters,
} from "../stages/voice/catalog/voiceCatalogValueNormalization.js";
import { hostedVoiceExecutionConfirmationSchema } from "../stages/voice/voiceExecutionConfirmation.js";

export { episodeCreationRequestSchema } from "../stages/episode/episodeSnapshotContracts.js";
export { elevenLabsDiagnosticSmokeRequestSchema } from "../stages/voice/elevenLabsDiagnosticSmoke.js";
export {
  soundtrackAnalyzeRequestSchema,
  soundtrackConfigureRequestSchema,
  soundtrackDecisionRequestSchema,
  soundtrackImportRequestSchema,
  soundtrackPrepareRequestSchema,
} from "./soundtrackActionRequestSchemas.js";
export {
  hostedVisualGenerationRequestSchema,
  hostedVisualPlanRequestSchema,
  localVisualGenerationRequestSchema,
  visualActivateRevisionRequestSchema,
  visualDecisionRequestSchema,
  visualImportRequestSchema,
  visualRegenerationRequestSchema,
} from "./visualActionRequestSchemas.js";

export const runIdSchema = z.string().refine(isValidRunId, { message: "Invalid run id." });
export const ideaApprovalRequestSchema = z.strictObject({
  ideaId: z.string().min(1),
  runId: runIdSchema,
});
export const scriptApprovalRequestSchema = z.strictObject({
  acknowledgeWarnings: z.boolean().default(false),
  runId: runIdSchema,
});
export const runOnlyRequestSchema = z.strictObject({ runId: runIdSchema });
export const hostedVoiceRunRequestSchema = z.strictObject({
  executionMode: z.literal("hosted"),
  runId: runIdSchema,
  ...hostedVoiceExecutionConfirmationSchema.shape,
});
export const voiceRunRequestSchema = z.union([runOnlyRequestSchema, hostedVoiceRunRequestSchema]);
export const voicePreviewRequestSchema = z.strictObject({
  runId: runIdSchema,
  voiceId: voiceIdSchema,
});
export const voiceSelectionRequestSchema = z.strictObject({
  runId: runIdSchema,
  voiceId: voiceSelectionInputSchema.shape.voiceId,
  reviewedBy: voiceSelectionInputSchema.shape.reviewedBy,
  notes: voiceSelectionInputSchema.shape.notes,
  confirmProductionRights: z.boolean(),
});
export const voiceReselectionRequestSchema = z.strictObject({
  reason: z
    .string()
    .trim()
    .min(1)
    .max(1_000)
    .refine((value) => !hasUnsafeNotesControlCharacters(value), "Reason contains unsafe controls."),
  reviewedBy: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .refine((value) => !hasUnsafeControlCharacters(value), "Reviewer contains unsafe controls."),
  runId: runIdSchema,
});

export const emptyRequestSchema = z.strictObject({});
const sha256DigestSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const localModelPrepareRequestSchema = z.strictObject({
  operation: z.enum(["setup", "verify", "smoke"]),
  packageId: z.literal("mflux-flux2-klein-4b-q4"),
});
export const localModelExecuteRequestSchema = z.strictObject({
  approvedBy: z.string().trim().min(1).max(160),
  bindingDigest: sha256DigestSchema,
  confirmExecution: z.literal(true),
  runId: runIdSchema,
});
const attributedSettingsSaveShape = {
  editor: z.string().trim().min(1).max(160),
  expectedCurrentDigest: sha256DigestSchema,
  note: z.string().trim().min(1).max(1_000),
} as const;
export const editableSettingsSchema = z.strictObject({
  studio: producerConfigSchema.shape.studio,
  providers: z.strictObject({
    llm: producerConfigSchema.shape.providers.shape.llm,
    tts: producerConfigSchema.shape.providers.shape.tts,
    imageGeneration: producerConfigSchema.shape.providers.shape.imageGeneration,
  }),
  budgets: producerConfigSchema.shape.budgets,
});
export const settingsSaveRequestSchema = z.strictObject({
  ...attributedSettingsSaveShape,
  settings: editableSettingsSchema,
});
export const promptProfileSaveRequestSchema = z.strictObject({
  ...attributedSettingsSaveShape,
  expectedProfileDigest: sha256DigestSchema,
  makeActive: z.boolean().default(false),
  profile: promptProfileSchema,
});
export const localModelCandidateNameSchema = z.string().trim().min(1).max(240);
export const localModelCandidateEvalRequestSchema = z
  .strictObject({
    candidates: z.array(localModelCandidateNameSchema).max(12).default([]),
    includeLocalGguf: z.boolean().default(false),
  })
  .refine((input) => input.includeLocalGguf || input.candidates.length > 0, {
    message: "Candidate evaluation requires at least one model name or local GGUF discovery.",
    path: ["candidates"],
  });

export const revisionContentSchema = z.string().min(1).max(200_000);
export const analyticsImportContentSchema = z.string().min(1).max(1_000_000);
export const analyticsSourceFileNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .refine(
    (value) => !value.includes("/") && !value.includes("\\") && value !== "." && value !== "..",
    { message: "Analytics source file name must not contain path separators." },
  )
  .refine((value) => !hasUnsafeControlCharacters(value), {
    message: "Analytics source file name contains unsafe controls.",
  });
export const analyticsImportRequestSchema = z.strictObject({
  content: analyticsImportContentSchema,
  format: z.enum(["csv", "json"]),
  sourceFileName: analyticsSourceFileNameSchema,
});
export const scriptRevisionRequestSchema = z.strictObject({
  content: revisionContentSchema,
  editor: z.string().trim().min(1).max(200),
  reason: z.string().trim().min(1).max(4_000),
  runId: runIdSchema,
});
export const packageArtifactRevisionRequestSchema = z.strictObject({
  artifactKey: z.enum(["subtitles", "scenes", "popup-cards", "youtube-metadata"]),
  content: revisionContentSchema,
  editor: z.string().trim().min(1).max(200),
  reason: z.string().trim().min(1).max(4_000),
  runId: runIdSchema,
});
export const localReviewRequestShape = {
  notes: z.string().trim().min(1).max(4_000),
  reviewedBy: z.string().trim().min(1).max(200),
  runId: runIdSchema,
} as const;
export const renderDecisionRequestSchema = z.strictObject({
  decision: z.enum(renderDecisionValues),
  ...localReviewRequestShape,
});
export const channelHandoffDecisionRequestSchema = z
  .strictObject({
    decision: z.enum(channelHandoffDecisionValues),
    ...localReviewRequestShape,
    thumbnailCandidateId: z.string().trim().min(1).max(120).optional(),
  })
  .refine(
    (input) =>
      input.decision !== "accepted-for-manual-channel-prep" || Boolean(input.thumbnailCandidateId),
    {
      message: "Accepted channel handoff decisions require a thumbnail candidate.",
      path: ["thumbnailCandidateId"],
    },
  );
