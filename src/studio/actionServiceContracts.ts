import { z } from "zod";
import {
  studioMutationServiceMetadata,
  type StudioMutationActionId,
  type StudioMutationAvailability,
} from "./actionServiceMetadata.js";
import {
  studioMutationRequestSchemaByAction,
  type StudioActionRequestById,
} from "./actionServiceRequestContracts.js";

export { studioMutationActionIds } from "./actionServiceMetadata.js";
export * from "./actionServiceRequestContracts.js";

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
  requestSchema: studioMutationRequestSchemaByAction[metadata.actionId],
})) as readonly StudioMutationServiceContract[];

export type StudioMutationServiceContractId = StudioMutationActionId;

/** Parses a Studio mutation request for the given action. */
export function parseStudioMutationRequest<ActionId extends StudioMutationActionId>(
  actionId: ActionId,
  input: unknown,
): StudioActionRequestById[ActionId] {
  return getStudioMutationServiceContract(actionId).requestSchema.parse(
    input,
  ) as StudioActionRequestById[ActionId];
}

/** Gets the Studio mutation service contract for an action. */
export function getStudioMutationServiceContract(
  actionId: StudioMutationActionId,
): StudioMutationServiceContract {
  const contract = studioMutationServiceContracts.find((item) => item.actionId === actionId);
  if (!contract) throw new Error(`Unknown Studio mutation service contract: ${actionId}`);
  return contract;
}

/** Checks whether a Studio mutation service contract exists for an action ID. */
export function hasStudioMutationServiceContract(actionId: string): boolean {
  return studioMutationServiceContracts.some((item) => item.actionId === actionId);
}
