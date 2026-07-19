import { z } from "zod";
import { isValidRunId } from "../../../../../src/core/runId";
import { channelHandoffDecisionValues } from "../../../../../src/stages/channel/channelHandoffDecisionContracts";
import { renderDecisionValues } from "../../../../../src/stages/render/renderDecisionCommands";
import {
  elevenLabsDiagnosticSmokeRequestSchema,
  episodeCreationRequestSchema,
  hostedVisualGenerationRequestSchema,
  hostedVisualPlanRequestSchema,
  localModelExecuteRequestSchema,
  localModelPrepareRequestSchema,
  localVisualGenerationRequestSchema,
  promptProfileSaveRequestSchema,
  runOnlyRequestSchema,
  settingsSaveRequestSchema,
  soundtrackAnalyzeRequestSchema,
  soundtrackConfigureRequestSchema,
  soundtrackDecisionRequestSchema,
  soundtrackImportRequestSchema,
  soundtrackPrepareRequestSchema,
  visualActivateRevisionRequestSchema,
  visualDecisionRequestSchema,
  visualImportRequestSchema,
  visualRegenerationRequestSchema,
  voicePreviewRequestSchema,
  voiceReselectionRequestSchema,
  voiceRunRequestSchema,
  voiceSelectionRequestSchema,
} from "../../../../../src/studio/actionServiceRequestContracts";

const runIdSchema = z.string().refine(isValidRunId, { message: "Invalid run id." });
const localReviewPayloadShape = {
  notes: z.string().trim().min(1).max(4_000),
  reviewedBy: z.string().trim().min(1).max(200),
  runId: runIdSchema,
} as const;

const ideaApprovalPayloadSchema = z.strictObject({ ideaId: z.string().min(1), runId: runIdSchema });

const scriptApprovalPayloadSchema = z.strictObject({
  acknowledgeWarnings: z.boolean().default(false),
  runId: runIdSchema,
});

const emptyPayloadSchema = z.strictObject({});
const localModelCandidateNameSchema = z.string().trim().min(1).max(240);
const localModelCandidateEvalPayloadSchema = z
  .strictObject({
    candidates: z.array(localModelCandidateNameSchema).max(12).default([]),
    includeLocalGguf: z.boolean().default(false),
  })
  .refine((input) => input.includeLocalGguf || input.candidates.length > 0, {
    message: "Candidate evaluation requires at least one model name or local GGUF discovery.",
    path: ["candidates"],
  });

const revisionContentSchema = z.string().min(1).max(200_000);
const analyticsImportContentSchema = z.string().min(1).max(1_000_000);
const analyticsSourceFileNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .refine(
    (value) => !value.includes("/") && !value.includes("\\") && value !== "." && value !== "..",
    { message: "Analytics source file name must not contain path separators." },
  );

const analyticsImportPayloadSchema = z.strictObject({
  content: analyticsImportContentSchema,
  format: z.enum(["csv", "json"]),
  sourceFileName: analyticsSourceFileNameSchema,
});

const scriptRevisionPayloadSchema = z.strictObject({
  content: revisionContentSchema,
  editor: z.string().trim().min(1).max(200),
  reason: z.string().trim().min(1).max(4_000),
  runId: runIdSchema,
});

const packageArtifactRevisionPayloadSchema = z.strictObject({
  artifactKey: z.enum(["subtitles", "scenes", "popup-cards", "youtube-metadata"]),
  content: revisionContentSchema,
  editor: z.string().trim().min(1).max(200),
  reason: z.string().trim().min(1).max(4_000),
  runId: runIdSchema,
});

const renderDecisionPayloadSchema = z.strictObject({
  decision: z.enum(renderDecisionValues),
  ...localReviewPayloadShape,
});

const channelHandoffDecisionPayloadSchema = z
  .strictObject({
    decision: z.enum(channelHandoffDecisionValues),
    ...localReviewPayloadShape,
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

export function parseIdeaApprovalPayload(
  payload: unknown,
): z.infer<typeof ideaApprovalPayloadSchema> {
  return ideaApprovalPayloadSchema.parse(payload);
}

export function parseScriptApprovalPayload(
  payload: unknown,
): z.infer<typeof scriptApprovalPayloadSchema> {
  return scriptApprovalPayloadSchema.parse(payload);
}

export function parseScriptRevisionPayload(
  payload: unknown,
): z.infer<typeof scriptRevisionPayloadSchema> {
  return scriptRevisionPayloadSchema.parse(payload);
}

export function parsePackageArtifactRevisionPayload(
  payload: unknown,
): z.infer<typeof packageArtifactRevisionPayloadSchema> {
  return packageArtifactRevisionPayloadSchema.parse(payload);
}

export function parseAnalyticsImportPayload(
  payload: unknown,
): z.infer<typeof analyticsImportPayloadSchema> {
  return analyticsImportPayloadSchema.parse(payload);
}

export function parseSettingsSavePayload(
  payload: unknown,
): z.infer<typeof settingsSaveRequestSchema> {
  return settingsSaveRequestSchema.parse(payload);
}

export function parsePromptProfileSavePayload(
  payload: unknown,
): z.infer<typeof promptProfileSaveRequestSchema> {
  return promptProfileSaveRequestSchema.parse(payload);
}

export function parseElevenLabsDiagnosticSmokePayload(
  payload: unknown,
): z.infer<typeof elevenLabsDiagnosticSmokeRequestSchema> {
  return elevenLabsDiagnosticSmokeRequestSchema.parse(payload);
}

export function parseEpisodeCreationPayload(
  payload: unknown,
): z.infer<typeof episodeCreationRequestSchema> {
  return episodeCreationRequestSchema.parse(payload);
}

export function parseRunOnlyPayload(payload: unknown): z.infer<typeof runOnlyRequestSchema> {
  return runOnlyRequestSchema.parse(payload);
}

export function parseVisualImportPayload(
  payload: unknown,
): z.infer<typeof visualImportRequestSchema> {
  return visualImportRequestSchema.parse(payload);
}

export function parseSoundtrackPreparePayload(
  payload: unknown,
): z.infer<typeof soundtrackPrepareRequestSchema> {
  return soundtrackPrepareRequestSchema.parse(payload);
}

export function parseSoundtrackImportPayload(
  payload: unknown,
): z.infer<typeof soundtrackImportRequestSchema> {
  return soundtrackImportRequestSchema.parse(payload);
}

export function parseSoundtrackConfigurePayload(
  payload: unknown,
): z.infer<typeof soundtrackConfigureRequestSchema> {
  return soundtrackConfigureRequestSchema.parse(payload);
}

export function parseSoundtrackAnalyzePayload(
  payload: unknown,
): z.infer<typeof soundtrackAnalyzeRequestSchema> {
  return soundtrackAnalyzeRequestSchema.parse(payload);
}

export function parseSoundtrackDecisionPayload(
  payload: unknown,
): z.infer<typeof soundtrackDecisionRequestSchema> {
  return soundtrackDecisionRequestSchema.parse(payload);
}

export function parseVisualDecisionPayload(
  payload: unknown,
): z.infer<typeof visualDecisionRequestSchema> {
  return visualDecisionRequestSchema.parse(payload);
}

/**
 * Validates a visual regeneration request payload.
 *
 * @param payload - The unknown payload to validate
 * @returns The validated visual regeneration request
 */
export function parseVisualRegenerationPayload(
  payload: unknown,
): z.infer<typeof visualRegenerationRequestSchema> {
  return visualRegenerationRequestSchema.parse(payload);
}

/**
 * Validates a local visual generation request payload.
 *
 * @param payload - The value to validate against the local visual generation request schema.
 * @returns The validated local visual generation request.
 */
export function parseLocalVisualGenerationPayload(
  payload: unknown,
): z.infer<typeof localVisualGenerationRequestSchema> {
  return localVisualGenerationRequestSchema.parse(payload);
}

/**
 * Validates and parses a payload for activating a visual revision.
 *
 * @param payload - The unknown payload to validate.
 * @returns The validated visual revision activation payload.
 */
export function parseVisualActivateRevisionPayload(
  payload: unknown,
): z.infer<typeof visualActivateRevisionRequestSchema> {
  return visualActivateRevisionRequestSchema.parse(payload);
}

/**
 * Validates a local model preparation request payload.
 *
 * @param payload - The untrusted request payload to validate.
 * @returns The validated local model preparation request.
 */
export function parseLocalModelPreparePayload(
  payload: unknown,
): z.infer<typeof localModelPrepareRequestSchema> {
  return localModelPrepareRequestSchema.parse(payload);
}

/**
 * Validates and parses a local model execution request payload.
 *
 * @param payload - The untrusted request payload to validate
 * @returns The validated local model execution request
 */
export function parseLocalModelExecutePayload(
  payload: unknown,
): z.infer<typeof localModelExecuteRequestSchema> {
  return localModelExecuteRequestSchema.parse(payload);
}

/**
 * Validates a hosted visual plan mutation payload.
 *
 * @param payload - The unknown payload to validate
 * @returns The validated hosted visual plan payload
 */
export function parseHostedVisualPlanPayload(
  payload: unknown,
): z.infer<typeof hostedVisualPlanRequestSchema> {
  return hostedVisualPlanRequestSchema.parse(payload);
}

/**
 * Validates a hosted visual generation request payload.
 *
 * @param payload - The untrusted payload to validate
 * @returns The validated hosted visual generation request
 */
export function parseHostedVisualGenerationPayload(
  payload: unknown,
): z.infer<typeof hostedVisualGenerationRequestSchema> {
  return hostedVisualGenerationRequestSchema.parse(payload);
}

/**
 * Validates a voice run request payload.
 *
 * @param payload - The payload to validate.
 * @returns The validated voice run request.
 */
export function parseVoiceRunPayload(payload: unknown): z.infer<typeof voiceRunRequestSchema> {
  return voiceRunRequestSchema.parse(payload);
}

export function parseVoicePreviewPayload(
  payload: unknown,
): z.infer<typeof voicePreviewRequestSchema> {
  return voicePreviewRequestSchema.parse(payload);
}

export function parseVoiceSelectionPayload(
  payload: unknown,
): z.infer<typeof voiceSelectionRequestSchema> {
  return voiceSelectionRequestSchema.parse(payload);
}

export function parseVoiceReselectionPayload(
  payload: unknown,
): z.infer<typeof voiceReselectionRequestSchema> {
  return voiceReselectionRequestSchema.parse(payload);
}

export function parseEmptyPayload(payload: unknown): z.infer<typeof emptyPayloadSchema> {
  return emptyPayloadSchema.parse(payload);
}

export function parseLocalModelCandidateEvalPayload(
  payload: unknown,
): z.infer<typeof localModelCandidateEvalPayloadSchema> {
  return localModelCandidateEvalPayloadSchema.parse(payload);
}

export function parseRenderDecisionPayload(
  payload: unknown,
): z.infer<typeof renderDecisionPayloadSchema> {
  return renderDecisionPayloadSchema.parse(payload);
}

export function parseChannelHandoffDecisionPayload(
  payload: unknown,
): z.infer<typeof channelHandoffDecisionPayloadSchema> {
  return channelHandoffDecisionPayloadSchema.parse(payload);
}
