import { studioMutationServiceContracts } from "../../../../src/studio/actionServiceContracts";
import { disabledStudioActionRoutes, routeSecurityFindings } from "./routeSecurity";

export type StudioActionServiceStatus = {
  actionCount: number;
  disabledRouteCount: number;
  findings: string[];
  readyForCliCount: number;
  riskyExternalCount: number;
  summaries: StudioActionServiceSummary[];
  webMutationsEnabled: boolean;
};

export type StudioActionServiceSummary = {
  actionId: string;
  availability: string;
  cliCommand: string;
  description: string;
  routePath: string;
};

/**
 * Summarizes the studio action service status.
 *
 * @returns The current action counts, security findings, route summaries, and web mutation status.
 */
export function getStudioActionServiceStatus(): StudioActionServiceStatus {
  const summaries = studioMutationServiceContracts
    .map((contract) => {
      const route = disabledStudioActionRoutes.find(
        (candidate) => candidate.serviceContractId === contract.actionId,
      );
      return {
        actionId: contract.actionId,
        availability: contract.availability,
        cliCommand: contract.cliCommand,
        description: contract.description,
        routePath: route?.path ?? "unrouted",
      };
    })
    .sort((left, right) => left.actionId.localeCompare(right.actionId));
  return {
    actionCount: summaries.length,
    disabledRouteCount: disabledStudioActionRoutes.filter((route) => !route.enabled).length,
    findings: routeSecurityFindings(),
    readyForCliCount: summaries.filter((summary) => summary.availability === "ready-for-cli")
      .length,
    riskyExternalCount: summaries.filter((summary) => summary.availability === "disabled-external")
      .length,
    summaries,
    webMutationsEnabled: disabledStudioActionRoutes.some((route) => route.enabled),
  };
}
