import type { Route } from "next";
import type { StudioActionServiceSummary } from "@/lib/actionServiceStatus";

export type ServiceContractGroup = Readonly<{
  description: string;
  summaries: readonly StudioActionServiceSummary[];
  title: string;
}>;

export type ActionSurface = Readonly<{
  href: Route;
  label: string;
}>;

/**
 * Groups Studio action contracts by operator availability.
 *
 * @param summaries - Action summaries produced from the shared service metadata.
 * @returns Guarded local actions first, then disabled external-risk actions.
 */
export function serviceContractGroups(
  summaries: readonly StudioActionServiceSummary[],
): readonly ServiceContractGroup[] {
  const guarded = summaries.filter((summary) => summary.availability === "ready-for-cli");
  const disabled = summaries.filter((summary) => summary.availability === "disabled-external");
  return [
    {
      description:
        "These routes are local-only POST actions backed by typed CLI/core contracts and route security.",
      summaries: guarded,
      title: "Guarded local actions",
    },
    {
      description:
        "These public or external-risk actions remain unavailable from Studio until future config, approval, and evidence contracts exist.",
      summaries: disabled,
      title: "Disabled external actions",
    },
  ];
}

/**
 * Resolves the real operator surface for an action contract.
 *
 * Action routes are POST endpoints, not pages. The catalog links to the safe Studio surface where
 * the operator can review or execute the guarded action.
 *
 * @param actionId - Studio action contract identifier.
 * @returns The operator-facing Studio surface and CTA label.
 */
export function actionSurface(actionId: string): ActionSurface {
  if (actionId.startsWith("analytics.")) {
    return { href: "/analytics" as Route, label: "Open analytics surface" };
  }
  if (actionId === "doctor.run") {
    return { href: "/doctor" as Route, label: "Open doctor surface" };
  }
  if (actionId === "ideas.run") {
    return { href: "/" as Route, label: "Open start-run surface" };
  }
  return { href: "/runs" as Route, label: "Open run queue" };
}

/**
 * Explains the execution boundary for one action contract.
 *
 * @param summary - Studio action summary.
 * @returns Operator-facing boundary copy.
 */
export function serviceBoundaryCopy(summary: StudioActionServiceSummary): string {
  if (summary.availability === "disabled-external") {
    return "No Studio route executes this action; upload and publish stay blocked.";
  }
  if (summary.routePath === "unrouted") {
    return "Contract exists, but no guarded route is currently exposed.";
  }
  return "Same-origin JSON, Studio action header, local session proof, and CLI/core gates required.";
}
