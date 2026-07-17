import { studioMutationActionIds } from "../../../../../src/studio/actionServiceMetadata";
import type { StudioRouteRisk, StudioRouteSecurityContract } from "../routeSecurity";

/**
 * Collects route-security findings for a single contract.
 *
 * @param contract - The route contract to evaluate
 * @returns The findings generated for `contract`
 */
export function routeFindings(contract: StudioRouteSecurityContract): string[] {
  const findings: string[] = [];
  if (contract.enabled && isMutationRisk(contract.risk)) {
    findings.push(...enabledActionFindings(contract));
  }
  if (!contract.enabled && isMutationRisk(contract.risk)) {
    findings.push(...disabledActionFindings(contract));
  }
  return findings;
}

function isMutationRisk(risk: StudioRouteRisk): boolean {
  return risk === "external-side-effect" || risk === "local-mutation" || risk === "publish-risk";
}

/**
 * Collects route-security findings for an enabled Studio mutation action.
 *
 * @param contract - The route security contract to evaluate
 * @returns A list of findings describing unsafe enabled mutation-route settings
 */
function enabledActionFindings(contract: StudioRouteSecurityContract): string[] {
  const findings = commonMutationFindings(contract);
  if (
    contract.risk === "publish-risk" ||
    (contract.risk === "external-side-effect" && contract.requiredApproval !== "cost")
  ) {
    findings.push(`${contract.id} exposes external or publish risk from Studio.`);
  }
  if (contract.allowedMethods.length !== 1 || contract.allowedMethods[0] !== "POST") {
    findings.push(`${contract.id} must only expose POST.`);
  }
  if (contract.disabledReason) {
    findings.push(`${contract.id} is enabled but still has a disabled reason.`);
  }
  return findings;
}

/**
 * Collects route-security findings for a disabled Studio mutation action.
 *
 * @param contract - The route security contract to evaluate
 * @returns A list of findings describing missing mutation-route requirements
 */
function disabledActionFindings(contract: StudioRouteSecurityContract): string[] {
  const findings = commonMutationFindings(contract);
  if (!contract.disabledReason) {
    findings.push(`${contract.id} needs a disabled reason.`);
  }
  return findings;
}

function commonMutationFindings(contract: StudioRouteSecurityContract): string[] {
  const findings: string[] = [];
  if (!contract.requiresCoreServiceContract) {
    findings.push(`${contract.id} needs a shared CLI/core service contract.`);
  }
  if (
    !contract.serviceContractId ||
    !studioMutationActionIds.includes(contract.serviceContractId)
  ) {
    findings.push(`${contract.id} needs a valid Studio mutation service contract.`);
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
  return findings;
}
