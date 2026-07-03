import type { StudioMutationActionId } from "../../../../src/studio/actionServiceMetadata";
import { routeFindings } from "./routeSecurityFindings";

export type StudioRouteMethod = "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
export type StudioRouteRisk =
  "external-side-effect" | "local-mutation" | "local-session" | "publish-risk" | "read-only";

export type StudioRouteSecurityContract = {
  allowedMethods: readonly StudioRouteMethod[];
  disabledReason: string | null;
  enabled: boolean;
  id: string;
  path: string;
  requiredApproval:
    "cost" | "idea" | "none" | "publish" | "render" | "review" | "script" | "upload";
  requiresCoreServiceContract: boolean;
  requiresCsrfProtection: boolean;
  requiresEvidenceWrite: boolean;
  risk: StudioRouteRisk;
  serviceContractId: StudioMutationActionId | null;
};

export const readOnlyStudioRoutes = [
  route("home", "/"),
  route("runs.index", "/runs"),
  route("runs.detail", "/runs/[runId]"),
  route("runs.media", "/runs/[runId]/media/[...artifactPath]"),
  route("assets.index", "/assets"),
  route("analytics.index", "/analytics"),
  route("doctor.index", "/doctor"),
  route("eval.index", "/eval"),
  route("forbidden.boundary", "/forbidden"),
  route("prompts.index", "/prompts"),
  route("unauthorized.boundary", "/unauthorized"),
] as const satisfies readonly StudioRouteSecurityContract[];

export const disabledStudioActionRoutes = [
  action("upload.private", "/actions/upload-private", "upload", "external-side-effect", false),
  action("publish.schedule", "/actions/publish-schedule", "publish", "publish-risk", false),
] as const satisfies readonly StudioRouteSecurityContract[];

export const enabledStudioActionRoutes = [
  action("idea.approve", "/actions/approve-idea", "idea", "local-mutation", true),
  action("script.approve", "/actions/approve-script", "script", "local-mutation", true),
  action("cost.approve", "/actions/approve-cost", "cost", "local-mutation", true),
  action("render.approve", "/actions/approve-render", "render", "local-mutation", true),
  action("render.decide", "/actions/decide-render", "review", "local-mutation", true),
  action(
    "channel-handoff.decide",
    "/actions/decide-channel-handoff",
    "review",
    "local-mutation",
    true,
  ),
] as const satisfies readonly StudioRouteSecurityContract[];

export const studioSessionRoutes = [
  sessionRoute("actions.session", "/actions/session"),
] as const satisfies readonly StudioRouteSecurityContract[];

export const studioActionRoutes = [
  ...disabledStudioActionRoutes,
  ...enabledStudioActionRoutes,
] as const satisfies readonly StudioRouteSecurityContract[];

export const studioRouteSecurityContracts = [
  ...readOnlyStudioRoutes,
  ...studioSessionRoutes,
  ...studioActionRoutes,
] as const satisfies readonly StudioRouteSecurityContract[];

/**
 * Collects route security findings for the provided contracts.
 *
 * @param contracts - The contracts to evaluate.
 * @returns The combined findings for all contracts.
 */
export function routeSecurityFindings(
  contracts: readonly StudioRouteSecurityContract[] = studioRouteSecurityContracts,
): string[] {
  return contracts.flatMap((contract) => routeFindings(contract));
}

/**
 * Creates a read-only Studio route security contract.
 *
 * @param id - The route identifier
 * @param path - The route path
 * @returns A contract configured for an enabled GET-only route with read-only risk
 */
function route(id: string, path: string): StudioRouteSecurityContract {
  return {
    allowedMethods: ["GET"],
    disabledReason: null,
    enabled: true,
    id,
    path,
    requiredApproval: "none",
    requiresCoreServiceContract: false,
    requiresCsrfProtection: false,
    requiresEvidenceWrite: false,
    risk: "read-only",
    serviceContractId: null,
  };
}

/**
 * Creates a same-origin local session route contract for guarded Studio mutations.
 *
 * @param id - The route identifier
 * @param path - The route path
 * @returns A contract configured for the token-issuing local session endpoint
 */
function sessionRoute(id: string, path: string): StudioRouteSecurityContract {
  return {
    allowedMethods: ["GET"],
    disabledReason: null,
    enabled: true,
    id,
    path,
    requiredApproval: "none",
    requiresCoreServiceContract: false,
    requiresCsrfProtection: false,
    requiresEvidenceWrite: false,
    risk: "local-session",
    serviceContractId: null,
  };
}

/**
 * Creates a Studio mutation route contract.
 *
 * @param id - The mutation service contract identifier
 * @param path - The route path
 * @param requiredApproval - The approval level required for the route
 * @param risk - The route risk classification
 * @param enabled - Whether route security has been implemented for this mutation
 * @returns The configured Studio route security contract
 */
function action(
  id: StudioMutationActionId,
  path: string,
  requiredApproval: StudioRouteSecurityContract["requiredApproval"],
  risk: Exclude<StudioRouteRisk, "read-only">,
  enabled: boolean,
): StudioRouteSecurityContract {
  return {
    allowedMethods: ["POST"],
    disabledReason: enabled
      ? null
      : "Studio mutations require shared CLI/core service contracts, route security, evidence writes, and negative tests before implementation.",
    enabled,
    id,
    path,
    requiredApproval,
    requiresCoreServiceContract: true,
    requiresCsrfProtection: true,
    requiresEvidenceWrite: true,
    risk,
    serviceContractId: id,
  };
}
