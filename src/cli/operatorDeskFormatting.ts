import { formatStatusReadiness, type StatusReadinessSummary } from "../stages/statusReadiness.js";
import type { RunDiagnosticSummary } from "../stages/runDiagnosticSummaryContracts.js";
import type { StatusWorkflowStep } from "../stages/statusWorkflow.js";

/**
 * Formats readiness diagnostics for the operator desk.
 *
 * @param readiness - The readiness summary from the shared status contract.
 * @returns Operator-facing readiness lines.
 */
export function formatOperatorDeskReadinessLines(readiness: StatusReadinessSummary): string[] {
  return formatStatusReadiness(readiness).flatMap(splitNextActionLine);
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
 * Formats safe provider/stage diagnostics for the operator desk.
 *
 * @param diagnostics - Current run diagnostic summaries.
 * @returns Lines for the diagnostics section.
 */
export function formatOperatorDeskDiagnosticLines(
  diagnostics: readonly RunDiagnosticSummary[],
): string[] {
  if (diagnostics.length === 0) {
    return ["Diagnostics: none"];
  }
  return [
    "Diagnostics:",
    ...diagnostics.flatMap((diagnostic) => {
      const detail = diagnostic.failureKind ? ` (${diagnostic.failureKind})` : "";
      const line = `- ${diagnostic.path} [${diagnostic.stage}]: ${diagnostic.message}${detail}`;
      return diagnostic.nextAction ? [line, `  Next action: ${diagnostic.nextAction}`] : [line];
    }),
  ];
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
export function formatOperatorDeskWorkflowLines(workflow: readonly StatusWorkflowStep[]): string[] {
  return [
    "Workflow progress:",
    ...workflow.map((step) => `- [${step.status}] ${step.label}: ${step.detail}`),
  ];
}

/**
 * Splits operator remediation commands onto their own line so Ink panels keep copy-paste commands readable.
 *
 * @param line - A formatted status/readiness line.
 * @returns The original line, or a label plus indented command line for next-action entries.
 */
function splitNextActionLine(line: string): string[] {
  const readinessPrefix = "Readiness next action: ";
  if (line.startsWith(readinessPrefix)) {
    return ["Readiness next action:", `  ${line.slice(readinessPrefix.length)}`];
  }

  const attentionPrefix = "  Next action: ";
  if (line.startsWith(attentionPrefix)) {
    return ["  Next action:", `    ${line.slice(attentionPrefix.length)}`];
  }

  return [line];
}
