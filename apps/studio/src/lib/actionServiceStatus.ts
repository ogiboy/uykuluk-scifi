import type {
  StudioMutationActionId,
  StudioMutationAvailability,
} from "../../../../src/studio/actionServiceMetadata";
import { studioMutationServiceMetadata } from "../../../../src/studio/actionServiceMetadata";
import {
  disabledStudioActionRoutes,
  routeSecurityFindings,
  studioActionRoutes,
} from "./routeSecurity";

export type StudioActionServiceStatus = {
  actionCount: number;
  cliFallbackCount: number;
  disabledRouteCount: number;
  findings: string[];
  readyForCliCount: number;
  riskyExternalCount: number;
  summaries: StudioActionServiceSummary[];
  webReadyCount: number;
  webMutationsEnabled: boolean;
};

export type StudioActionServiceSummary = {
  actionId: StudioMutationActionId;
  availability: StudioMutationAvailability;
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
  const summaries = studioMutationServiceMetadata
    .map((contract) => {
      const route = studioActionRoutes.find(
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
  const webReadyCount = summaries.filter(
    (summary) => summary.availability === "ready-for-cli" && summary.routePath !== "unrouted",
  ).length;
  const readyForCliCount = summaries.filter(
    (summary) => summary.availability === "ready-for-cli",
  ).length;
  return {
    actionCount: summaries.length,
    cliFallbackCount: readyForCliCount - webReadyCount,
    disabledRouteCount: disabledStudioActionRoutes.filter((route) => !route.enabled).length,
    findings: routeSecurityFindings(),
    readyForCliCount,
    riskyExternalCount: summaries.filter((summary) => summary.availability === "disabled-external")
      .length,
    summaries,
    webReadyCount,
    webMutationsEnabled: studioActionRoutes.some((route) => route.enabled),
  };
}
