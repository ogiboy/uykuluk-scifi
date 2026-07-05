import { z } from "zod";
import { isValidRunId } from "../core/runId.js";
import { channelHandoffDecisionValues } from "../stages/channelHandoffDecisionContracts.js";
import { renderDecisionValues } from "../stages/renderDecisionCommands.js";
import {
  studioMutationServiceMetadata,
  type StudioMutationActionId,
  type StudioMutationAvailability,
} from "./actionServiceMetadata.js";

export { studioMutationActionIds } from "./actionServiceMetadata.js";

export const runIdSchema = z.string().refine(isValidRunId, { message: "Invalid run id." });

export const ideaApprovalRequestSchema = z.strictObject({
  ideaId: z.string().min(1),
  runId: runIdSchema,
});

export const scriptApprovalRequestSchema = z.strictObject({
  acknowledgeWarnings: z.boolean().default(false),
  runId: runIdSchema,
});

export const runOnlyRequestSchema = z.strictObject({
  runId: runIdSchema,
});

export const emptyRequestSchema = z.strictObject({});

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

type StudioActionRequestById = {
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
  "package.run": z.infer<typeof runOnlyRequestSchema>;
  "publish.schedule": z.infer<typeof runOnlyRequestSchema>;
  "readiness.run": z.infer<typeof runOnlyRequestSchema>;
  "render.approve": z.infer<typeof runOnlyRequestSchema>;
  "render.decide": z.infer<typeof renderDecisionRequestSchema>;
  "render.review": z.infer<typeof runOnlyRequestSchema>;
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
  "voice.review": z.infer<typeof runOnlyRequestSchema>;
  "voice.run": z.infer<typeof runOnlyRequestSchema>;
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
  "package.run": runOnlyRequestSchema,
  "publish.schedule": runOnlyRequestSchema,
  "readiness.run": runOnlyRequestSchema,
  "render.approve": runOnlyRequestSchema,
  "render.decide": renderDecisionRequestSchema,
  "render.review": runOnlyRequestSchema,
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
  "voice.review": runOnlyRequestSchema,
  "voice.run": runOnlyRequestSchema,
} as const satisfies Record<StudioMutationActionId, z.ZodType>;

export type StudioMutationServiceContract = {
  actionId: StudioMutationActionId;
  availability: StudioMutationAvailability;
  cliCommand: string;
  coreExport: string;
  coreModule: string;
  description: string;
  requiresCsrfProtection: true;
  requiresDurableEvidence: true;
  requiresExplicitApproval: true;
  requestSchema: z.ZodType;
};

export const studioMutationServiceContracts = studioMutationServiceMetadata.map((metadata) => ({
  ...metadata,
  requiresCsrfProtection: true,
  requiresDurableEvidence: true,
  requiresExplicitApproval: true,
  requestSchema: requestSchemaForAction(metadata.actionId),
})) as readonly StudioMutationServiceContract[];

export type StudioMutationServiceContractId = StudioMutationActionId;

/**
 * Parses a Studio mutation request for the given action.
 *
 * @param actionId - The Studio mutation action to use for validation
 * @param input - The value to validate and parse
 * @returns The parsed request for the specified action
 */
export function parseStudioMutationRequest<ActionId extends StudioMutationActionId>(
  actionId: ActionId,
  input: unknown,
): StudioActionRequestById[ActionId] {
  return getStudioMutationServiceContract(actionId).requestSchema.parse(
    input,
  ) as StudioActionRequestById[ActionId];
}

/**
 * Gets the Studio mutation service contract for an action.
 *
 * @param actionId - The action identifier
 * @returns The matching Studio mutation service contract
 */
export function getStudioMutationServiceContract(
  actionId: StudioMutationActionId,
): StudioMutationServiceContract {
  const contract = studioMutationServiceContracts.find((item) => item.actionId === actionId);
  if (!contract) {
    throw new Error(`Unknown Studio mutation service contract: ${actionId}`);
  }
  return contract;
}

/**
 * Checks whether a Studio mutation service contract exists for an action ID.
 *
 * @param actionId - The action ID to look up
 * @returns `true` if a matching contract exists, `false` otherwise
 */
export function hasStudioMutationServiceContract(actionId: string): boolean {
  return studioMutationServiceContracts.some((item) => item.actionId === actionId);
}

/**
 * Resolves the request schema for a mutation action.
 *
 * @param actionId - The mutation action identifier.
 * @returns The schema that validates the action payload.
 */
function requestSchemaForAction(actionId: StudioMutationActionId): z.ZodType {
  return studioMutationRequestSchemaByAction[actionId];
}
