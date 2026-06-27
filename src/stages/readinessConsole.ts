import type { ReadinessCheck } from "./readiness.js";

export type ReadinessResult = {
  passed: boolean;
  checks: readonly ReadinessCheck[];
};

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
