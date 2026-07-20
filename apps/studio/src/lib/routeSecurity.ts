import type { StudioMutationActionId } from "../../../../src/studio/actionServiceMetadata";
import type { StudioCliMutationActionId } from "./mutations/studioCliMutationArgs";
import { routeFindings } from "./routing/routeSecurityFindings";

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
    | "analytics"
    | "cost"
    | "diagnostic"
    | "idea"
    | "none"
    | "publish"
    | "render"
    | "review"
    | "script"
    | "upload"
    | "workflow";
  requiresCoreServiceContract: boolean;
  requiresCsrfProtection: boolean;
  requiresEvidenceWrite: boolean;
  risk: StudioRouteRisk;
  serviceContractId: StudioMutationActionId | null;
};

type DisabledStudioActionId = Extract<
  StudioMutationActionId,
  "publish.schedule" | "upload.private"
>;
type StudioRouteActionId = DisabledStudioActionId | StudioCliMutationActionId;

export const readOnlyStudioRoutes = [
  route("home", "/"),
  route("actions.index", "/actions"),
  route("runs.index", "/runs"),
  route("runs.detail", "/runs/[runId]"),
  route("runs.media", "/runs/[runId]/media/[...artifactPath]"),
  route("runs.visual", "/runs/[runId]/visuals/[sceneIndex]"),
  route("ideas.index", "/ideas"),
  route("ideas.new", "/ideas/new"),
  route("assets.index", "/assets"),
  route("analytics.index", "/analytics"),
  route("doctor.index", "/doctor"),
  route("eval.index", "/eval"),
  route("forbidden.boundary", "/forbidden"),
  route("prompts.index", "/prompts"),
  route("settings.index", "/settings"),
  route("provider-smokes.elevenlabs.audio", "/provider-smokes/elevenlabs/[operationId]/audio"),
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
  action("analytics.import", "/actions/analytics-import", "analytics", "local-mutation", true),
  action("analytics.report", "/actions/analytics-report", "analytics", "local-mutation", true),
  action("doctor.run", "/actions/run-doctor", "workflow", "local-mutation", true),
  action("model-eval.run", "/actions/run-model-eval", "workflow", "local-mutation", true),
  action(
    "model-eval-candidates.run",
    "/actions/run-model-eval-candidates",
    "workflow",
    "local-mutation",
    true,
  ),
  action("ideas.run", "/actions/run-ideas", "workflow", "local-mutation", true),
  action("settings.save", "/actions/settings-save", "workflow", "local-mutation", true),
  action(
    "promptProfiles.save",
    "/actions/prompt-profiles-save",
    "workflow",
    "local-mutation",
    true,
  ),
  action("episodes.create", "/actions/episode-create", "workflow", "local-mutation", true),
  action(
    "localModels.prepare",
    "/actions/local-models-prepare",
    "diagnostic",
    "local-mutation",
    true,
  ),
  action(
    "localModels.execute",
    "/actions/local-models-execute",
    "workflow",
    "local-mutation",
    true,
  ),
  action(
    "providers.elevenlabs.smoke",
    "/actions/elevenlabs-smoke",
    "diagnostic",
    "external-side-effect",
    true,
  ),
  action("script.run", "/actions/run-script", "workflow", "local-mutation", true),
  action("script.review", "/actions/review-script", "workflow", "local-mutation", true),
  action("script.revise", "/actions/revise-script", "script", "local-mutation", true),
  action("package.run", "/actions/run-package", "workflow", "local-mutation", true),
  action(
    "package-artifact.revise",
    "/actions/revise-package-artifact",
    "script",
    "local-mutation",
    true,
  ),
  action("render-plan.run", "/actions/run-render-plan", "workflow", "local-mutation", true),
  action("render-plan.review", "/actions/review-render-plan", "workflow", "local-mutation", true),
  action("estimate.run", "/actions/run-estimate", "workflow", "local-mutation", true),
  action("evidence.run", "/actions/run-evidence", "workflow", "local-mutation", true),
  action("readiness.run", "/actions/run-readiness", "workflow", "local-mutation", true),
  action("visuals.prepare", "/actions/visuals-prepare", "workflow", "local-mutation", true),
  action("visuals.plan-hosted", "/actions/visuals-plan-hosted", "workflow", "local-mutation", true),
  action(
    "visuals.generate-hosted",
    "/actions/visuals-generate-hosted",
    "cost",
    "external-side-effect",
    true,
  ),
  action("visuals.import", "/actions/visuals-import", "review", "local-mutation", true),
  action("visuals.decide", "/actions/visuals-decide", "review", "local-mutation", true),
  action("visuals.regenerate", "/actions/visuals-regenerate", "review", "local-mutation", true),
  action(
    "visuals.generate-local",
    "/actions/visuals-generate-local",
    "review",
    "local-mutation",
    true,
  ),
  action(
    "visuals.activate-revision",
    "/actions/visuals-activate-revision",
    "review",
    "local-mutation",
    true,
  ),
  action("soundtrack.prepare", "/actions/soundtrack-prepare", "workflow", "local-mutation", true),
  action("soundtrack.import", "/actions/soundtrack-import", "review", "local-mutation", true),
  action("soundtrack.configure", "/actions/soundtrack-configure", "review", "local-mutation", true),
  action("soundtrack.analyze", "/actions/soundtrack-analyze", "review", "local-mutation", true),
  action("soundtrack.decide", "/actions/soundtrack-decide", "review", "local-mutation", true),
  action("voice.candidates", "/actions/voice-candidates", "workflow", "local-mutation", true),
  action("voice.preview", "/actions/voice-preview", "workflow", "local-mutation", true),
  action("voice.select", "/actions/voice-select", "review", "local-mutation", true),
  action("voice.reselect", "/actions/voice-reselect", "review", "local-mutation", true),
  action("voice.run", "/actions/run-voice", "workflow", "local-mutation", true),
  action("voice.review", "/actions/review-voice", "workflow", "local-mutation", true),
  action("render.run", "/actions/run-render", "workflow", "local-mutation", true),
  action("render.review", "/actions/review-render", "workflow", "local-mutation", true),
  action("render.revise", "/actions/revise-render", "render", "local-mutation", true),
  action("review-bundle.run", "/actions/run-review-bundle", "workflow", "local-mutation", true),
  action("channel-handoff.run", "/actions/run-channel-handoff", "workflow", "local-mutation", true),
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
  id: StudioRouteActionId,
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
