import { formatStatusReadiness, type StatusReadinessSummary } from "../stages/statusReadiness.js";

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
