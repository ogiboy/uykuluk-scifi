import type { ReadinessCheck } from "./readiness.js";

export type ReadinessResult = { passed: boolean; checks: readonly ReadinessCheck[] };

/**
 * Formats a readiness report for console output.
 *
 * @param runId - The run identifier used in the diagnostics path
 * @param result - The readiness result to format
 * @returns A multiline console string with the overall status, each check, and the diagnostics path
 */
export function formatReadinessConsole(runId: string, result: ReadinessResult): string {
  return [
    `Readiness ${result.passed ? "passed" : "blocked"}.`,
    ...result.checks.flatMap((check) => {
      const line = `[${check.status}] ${check.name}: ${check.message}`;
      return check.nextAction ? [line, `  Next action: ${check.nextAction}`] : [line];
    }),
    `Diagnostics: runs/${runId}/diagnostics/readiness.json`,
  ].join("\n");
}
