import { formatStatusReadiness, type StatusReadinessSummary } from "../stages/statusReadiness.js";
import type { OperatorDeskWorkflowStep } from "./operatorDeskWorkflow.js";

/**
 * Formats readiness diagnostics for the operator desk.
 *
 * @param readiness - The readiness summary from the shared status contract.
 * @returns Operator-facing readiness lines.
 */
export function formatOperatorDeskReadinessLines(readiness: StatusReadinessSummary): string[] {
  return formatStatusReadiness(readiness);
}

/**
 * Formats blocked actions for the operator desk.
 *
 * @param blockedActions - The current evidence-derived blocked action messages.
 * @returns Operator-facing blocked action lines.
 */
export function formatOperatorDeskBlockedActionLines(blockedActions: readonly string[]): string[] {
  if (blockedActions.length === 0) {
    return ["Blocked action details: none"];
  }
  return ["Blocked action details:", ...blockedActions.map((action) => `- ${action}`)];
}

/**
 * Formats recent artifact paths for the operator desk.
 *
 * @param recentArtifacts - Recent artifact-relative paths from the run status summary.
 * @returns Operator-facing recent artifact lines.
 */
export function formatOperatorDeskRecentArtifactLines(
  recentArtifacts: readonly string[],
): string[] {
  if (recentArtifacts.length === 0) {
    return ["Recent artifacts:", "- none"];
  }
  return ["Recent artifacts:", ...recentArtifacts.map((artifact) => `- ${artifact}`)];
}

/**
 * Formats v1 workflow progress rows for the operator desk.
 *
 * @param workflow - Ordered workflow progress rows.
 * @returns Operator-facing workflow progress lines.
 */
export function formatOperatorDeskWorkflowLines(
  workflow: readonly OperatorDeskWorkflowStep[],
): string[] {
  return [
    "Workflow progress:",
    ...workflow.map((step) => `- [${step.status}] ${step.label}: ${step.detail}`),
  ];
}
