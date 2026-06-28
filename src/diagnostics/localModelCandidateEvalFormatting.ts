import { table } from "../utils/markdown.js";
import { LocalModelCandidateEvalReport } from "./localModelCandidateEval.js";

/**
 * Formats a local model candidate evaluation report for console output.
 *
 * @param report - The completed candidate evaluation report.
 * @returns A newline-separated operator summary.
 */
export function formatLocalModelCandidateEvalConsole(
  report: LocalModelCandidateEvalReport,
): string {
  return [
    `Local model candidate eval ${report.passed ? "passed" : "blocked"}.`,
    `Provider: ${report.providerMode}`,
    `Config source: ${report.configSource}`,
    `Base overrides: ${report.baseOverrides.join(", ") || "none"}`,
    `Recommended: ${formatRecommendedCandidate(report)}`,
    ...report.candidates.map(
      (candidate) =>
        `[${candidate.passed ? "pass" : "block"}] ${candidate.configuredModel}: ${
          candidate.checks.filter((check) => check.status === "pass").length
        }/${candidate.checks.length} checks passed`,
    ),
    "Report: diagnostics/local_model_candidates_eval.md",
  ].join("\n");
}

/**
 * Renders the local model candidate evaluation report as operator-facing Markdown.
 *
 * @param report - The completed candidate evaluation report.
 * @returns Markdown that compares candidates without raw provider output.
 */
export function renderLocalModelCandidateEvalMarkdown(
  report: LocalModelCandidateEvalReport,
): string {
  return [
    "# Local Model Candidate Evaluation",
    "",
    `Created: ${report.createdAt}`,
    `Duration: ${report.durationMs} ms`,
    `Provider: ${report.providerMode}`,
    `Config source: ${report.configSource}`,
    `Base overrides: ${report.baseOverrides.join(", ") || "none"}`,
    `Passed: ${report.passed}`,
    `Recommended candidate: ${formatRecommendedCandidate(report)}`,
    "",
    table(
      ["Model", "Passed", "Passed checks", "Blocked checks", "Duration"],
      report.candidates.map((candidate) => [
        candidate.configuredModel,
        String(candidate.passed),
        String(candidate.checks.filter((check) => check.status === "pass").length),
        candidate.checks
          .filter((check) => check.status === "block")
          .map((check) => check.name)
          .join(", ") || "none",
        `${candidate.durationMs} ms`,
      ]),
    ),
    "",
    "Raw provider output is intentionally not persisted.",
    "",
  ].join("\n");
}

function formatRecommendedCandidate(report: LocalModelCandidateEvalReport): string {
  const candidate = report.recommendedCandidate;
  if (!candidate) {
    return "none; no candidate passed all checks";
  }
  return `${candidate.configuredModel} (${candidate.passedChecks} passed, ${
    candidate.blockedChecks
  } blocked, ${candidate.durationMs} ms)`;
}
