import { z } from "zod";
import { isValidRunId } from "../../../../src/core/runId";
import { channelHandoffDecisionValues } from "../../../../src/stages/channelHandoffDecisionContracts";
import { renderDecisionValues } from "../../../../src/stages/renderDecisionCommands";

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

const runOnlyPayloadSchema = z.strictObject({ runId: runIdSchema });

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

export function parseRunOnlyPayload(payload: unknown): z.infer<typeof runOnlyPayloadSchema> {
  return runOnlyPayloadSchema.parse(payload);
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
