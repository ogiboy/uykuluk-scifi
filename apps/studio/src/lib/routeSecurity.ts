export type StudioRouteMethod = "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
export type StudioRouteRisk =
  | "external-side-effect"
  | "local-mutation"
  | "publish-risk"
  | "read-only";

export type StudioRouteSecurityContract = {
  allowedMethods: readonly StudioRouteMethod[];
  disabledReason: string | null;
  enabled: boolean;
  id: string;
  path: string;
  requiredApproval: "cost" | "idea" | "none" | "publish" | "render" | "script" | "upload";
  requiresCoreServiceContract: boolean;
  requiresCsrfProtection: boolean;
  requiresEvidenceWrite: boolean;
  risk: StudioRouteRisk;
};

export const readOnlyStudioRoutes = [
  route("home", "/"),
  route("runs.index", "/runs"),
  route("runs.detail", "/runs/[runId]"),
  route("assets.index", "/assets"),
  route("analytics.index", "/analytics"),
] as const satisfies readonly StudioRouteSecurityContract[];

export const disabledStudioActionRoutes = [
  action("idea.approve", "/actions/approve-idea", "idea", "local-mutation"),
  action("script.approve", "/actions/approve-script", "script", "local-mutation"),
  action("cost.approve", "/actions/approve-cost", "cost", "local-mutation"),
  action("render.approve", "/actions/approve-render", "render", "local-mutation"),
  action("upload.private", "/actions/upload-private", "upload", "external-side-effect"),
  action("publish.schedule", "/actions/publish-schedule", "publish", "publish-risk"),
] as const satisfies readonly StudioRouteSecurityContract[];

export const studioRouteSecurityContracts = [
  ...readOnlyStudioRoutes,
  ...disabledStudioActionRoutes,
] as const satisfies readonly StudioRouteSecurityContract[];

export function routeSecurityFindings(
  contracts: readonly StudioRouteSecurityContract[] = studioRouteSecurityContracts,
): string[] {
  return contracts.flatMap((contract) => routeFindings(contract));
}

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
  };
}

function action(
  id: string,
  path: string,
  requiredApproval: StudioRouteSecurityContract["requiredApproval"],
  risk: Exclude<StudioRouteRisk, "read-only">,
): StudioRouteSecurityContract {
  return {
    allowedMethods: ["POST"],
    disabledReason:
      "Studio mutations require shared CLI/core service contracts, route security, evidence writes, and negative tests before implementation.",
    enabled: false,
    id,
    path,
    requiredApproval,
    requiresCoreServiceContract: true,
    requiresCsrfProtection: true,
    requiresEvidenceWrite: true,
    risk,
  };
}

function routeFindings(contract: StudioRouteSecurityContract): string[] {
  const findings: string[] = [];
  if (contract.enabled && contract.risk !== "read-only") {
    findings.push(`${contract.id} must stay disabled until route security is implemented.`);
  }
  if (contract.enabled && contract.allowedMethods.some((method) => method !== "GET")) {
    findings.push(`${contract.id} is enabled with a mutating HTTP method.`);
  }
  if (!contract.enabled && contract.risk !== "read-only") {
    findings.push(...disabledActionFindings(contract));
  }
  if (contract.risk === "publish-risk" && contract.enabled) {
    findings.push(`${contract.id} exposes publish risk from Studio.`);
  }
  return findings;
}

function disabledActionFindings(contract: StudioRouteSecurityContract): string[] {
  const findings: string[] = [];
  if (!contract.requiresCoreServiceContract) {
    findings.push(`${contract.id} needs a shared CLI/core service contract.`);
  }
  if (!contract.requiresCsrfProtection) {
    findings.push(`${contract.id} needs CSRF protection.`);
  }
  if (!contract.requiresEvidenceWrite) {
    findings.push(`${contract.id} needs durable evidence writes.`);
  }
  if (contract.requiredApproval === "none") {
    findings.push(`${contract.id} needs an explicit approval target.`);
  }
  if (!contract.disabledReason) {
    findings.push(`${contract.id} needs a disabled reason.`);
  }
  return findings;
}
