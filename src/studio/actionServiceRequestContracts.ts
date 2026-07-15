import { z } from "zod";
import { isValidRunId } from "../core/runId.js";
import { channelHandoffDecisionValues } from "../stages/channel/channelHandoffDecisionContracts.js";
import { renderDecisionValues } from "../stages/render/renderDecisionCommands.js";
import { voiceSelectionInputSchema } from "../stages/voice/catalog/voiceAuditionContracts.js";
import { voiceIdSchema } from "../stages/voice/catalog/voiceCatalogContracts.js";
import {
  hasUnsafeControlCharacters,
  hasUnsafeNotesControlCharacters,
} from "../stages/voice/catalog/voiceCatalogValueNormalization.js";
import { hostedVoiceExecutionConfirmationSchema } from "../stages/voice/voiceExecutionConfirmation.js";
import type { StudioMutationActionId } from "./actionServiceMetadata.js";
import {
  hostedVisualGenerationRequestSchema,
  hostedVisualPlanRequestSchema,
  visualDecisionRequestSchema,
  visualImportRequestSchema,
  visualRegenerationRequestSchema,
} from "./visualActionRequestSchemas.js";

export {
  hostedVisualGenerationRequestSchema,
  hostedVisualPlanRequestSchema,
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
  );
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

export type StudioActionRequestById = {
  "analytics.import": z.infer<typeof analyticsImportRequestSchema>;
  "analytics.report": z.infer<typeof emptyRequestSchema>;
  "channel-handoff.decide": z.infer<typeof channelHandoffDecisionRequestSchema>;
  "channel-handoff.run": z.infer<typeof runOnlyRequestSchema>;
  "cost.approve": z.infer<typeof runOnlyRequestSchema>;
  "doctor.run": z.infer<typeof emptyRequestSchema>;
  "estimate.run": z.infer<typeof runOnlyRequestSchema>;
  "evidence.run": z.infer<typeof runOnlyRequestSchema>;
  "idea.approve": z.infer<typeof ideaApprovalRequestSchema>;
  "ideas.run": z.infer<typeof emptyRequestSchema>;
  "model-eval.run": z.infer<typeof emptyRequestSchema>;
  "model-eval-candidates.run": z.infer<typeof localModelCandidateEvalRequestSchema>;
  "package.run": z.infer<typeof runOnlyRequestSchema>;
  "publish.schedule": z.infer<typeof runOnlyRequestSchema>;
  "readiness.run": z.infer<typeof runOnlyRequestSchema>;
  "render.approve": z.infer<typeof runOnlyRequestSchema>;
  "render.decide": z.infer<typeof renderDecisionRequestSchema>;
  "render.review": z.infer<typeof runOnlyRequestSchema>;
  "render.revise": z.infer<typeof runOnlyRequestSchema>;
  "render.run": z.infer<typeof runOnlyRequestSchema>;
  "render-plan.review": z.infer<typeof runOnlyRequestSchema>;
  "render-plan.run": z.infer<typeof runOnlyRequestSchema>;
  "review-bundle.run": z.infer<typeof runOnlyRequestSchema>;
  "script.approve": z.infer<typeof scriptApprovalRequestSchema>;
  "script.review": z.infer<typeof runOnlyRequestSchema>;
  "script.revise": z.infer<typeof scriptRevisionRequestSchema>;
  "script.run": z.infer<typeof runOnlyRequestSchema>;
  "package-artifact.revise": z.infer<typeof packageArtifactRevisionRequestSchema>;
  "upload.private": z.infer<typeof runOnlyRequestSchema>;
  "visuals.decide": z.infer<typeof visualDecisionRequestSchema>;
  "visuals.import": z.infer<typeof visualImportRequestSchema>;
  "visuals.plan-hosted": z.infer<typeof hostedVisualPlanRequestSchema>;
  "visuals.generate-hosted": z.infer<typeof hostedVisualGenerationRequestSchema>;
  "visuals.prepare": z.infer<typeof runOnlyRequestSchema>;
  "visuals.regenerate": z.infer<typeof visualRegenerationRequestSchema>;
  "voice.candidates": z.infer<typeof runOnlyRequestSchema>;
  "voice.preview": z.infer<typeof voicePreviewRequestSchema>;
  "voice.reselect": z.infer<typeof voiceReselectionRequestSchema>;
  "voice.review": z.infer<typeof runOnlyRequestSchema>;
  "voice.run": z.infer<typeof voiceRunRequestSchema>;
  "voice.select": z.infer<typeof voiceSelectionRequestSchema>;
};

export const studioMutationRequestSchemaByAction = {
  "analytics.import": analyticsImportRequestSchema,
  "analytics.report": emptyRequestSchema,
  "channel-handoff.decide": channelHandoffDecisionRequestSchema,
  "channel-handoff.run": runOnlyRequestSchema,
  "cost.approve": runOnlyRequestSchema,
  "doctor.run": emptyRequestSchema,
  "estimate.run": runOnlyRequestSchema,
  "evidence.run": runOnlyRequestSchema,
  "idea.approve": ideaApprovalRequestSchema,
  "ideas.run": emptyRequestSchema,
  "model-eval.run": emptyRequestSchema,
  "model-eval-candidates.run": localModelCandidateEvalRequestSchema,
  "package.run": runOnlyRequestSchema,
  "publish.schedule": runOnlyRequestSchema,
  "readiness.run": runOnlyRequestSchema,
  "render.approve": runOnlyRequestSchema,
  "render.decide": renderDecisionRequestSchema,
  "render.review": runOnlyRequestSchema,
  "render.revise": runOnlyRequestSchema,
  "render.run": runOnlyRequestSchema,
  "render-plan.review": runOnlyRequestSchema,
  "render-plan.run": runOnlyRequestSchema,
  "review-bundle.run": runOnlyRequestSchema,
  "script.approve": scriptApprovalRequestSchema,
  "script.review": runOnlyRequestSchema,
  "script.revise": scriptRevisionRequestSchema,
  "script.run": runOnlyRequestSchema,
  "package-artifact.revise": packageArtifactRevisionRequestSchema,
  "upload.private": runOnlyRequestSchema,
  "visuals.decide": visualDecisionRequestSchema,
  "visuals.import": visualImportRequestSchema,
  "visuals.plan-hosted": hostedVisualPlanRequestSchema,
  "visuals.generate-hosted": hostedVisualGenerationRequestSchema,
  "visuals.prepare": runOnlyRequestSchema,
  "visuals.regenerate": visualRegenerationRequestSchema,
  "voice.candidates": runOnlyRequestSchema,
  "voice.preview": voicePreviewRequestSchema,
  "voice.reselect": voiceReselectionRequestSchema,
  "voice.review": runOnlyRequestSchema,
  "voice.run": voiceRunRequestSchema,
  "voice.select": voiceSelectionRequestSchema,
} as const satisfies Record<StudioMutationActionId, z.ZodType>;
