import { z } from "zod";
import { isValidRunId } from "../core/runId";
import { renderDecisionValues } from "../stages/renderDecisionCommands";
import {
  studioMutationServiceMetadata,
  type StudioMutationActionId,
  type StudioMutationAvailability,
} from "./actionServiceMetadata";

export { studioMutationActionIds } from "./actionServiceMetadata";

const runIdSchema = z.string().refine(isValidRunId, { message: "Invalid run id." });

const ideaApprovalRequestSchema = z.strictObject({
  ideaId: z.string().min(1),
  runId: runIdSchema,
});

const scriptApprovalRequestSchema = z.strictObject({
  acknowledgeWarnings: z.boolean().default(false),
  runId: runIdSchema,
});

const runOnlyRequestSchema = z.strictObject({
  runId: runIdSchema,
});

const renderDecisionRequestSchema = z.strictObject({
  decision: z.enum(renderDecisionValues),
  notes: z.string().trim().min(1).max(4_000),
  reviewedBy: z.string().trim().min(1).max(200),
  runId: runIdSchema,
});

type StudioActionRequestById = {
  "cost.approve": z.infer<typeof runOnlyRequestSchema>;
  "idea.approve": z.infer<typeof ideaApprovalRequestSchema>;
  "publish.schedule": z.infer<typeof runOnlyRequestSchema>;
  "render.approve": z.infer<typeof runOnlyRequestSchema>;
  "render.decide": z.infer<typeof renderDecisionRequestSchema>;
  "script.approve": z.infer<typeof scriptApprovalRequestSchema>;
  "upload.private": z.infer<typeof runOnlyRequestSchema>;
};

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
  if (actionId === "idea.approve") {
    return ideaApprovalRequestSchema;
  }
  if (actionId === "script.approve") {
    return scriptApprovalRequestSchema;
  }
  if (actionId === "render.decide") {
    return renderDecisionRequestSchema;
  }
  return runOnlyRequestSchema;
}
