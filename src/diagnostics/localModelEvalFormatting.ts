import { table } from "../utils/markdown.js";
import { LocalModelEvalReport } from "./localModelEval.js";

/**
 * Formats a local model evaluation report for console output.
 *
 * @param report - The completed model evaluation report.
 * @returns A newline-separated operator summary.
 */
export function formatLocalModelEvalConsole(report: LocalModelEvalReport): string {
  return [
    `Local model eval ${report.passed ? "passed" : "blocked"}.`,
    `Provider: ${report.providerMode}`,
    `Model: ${report.configuredModel}`,
    `Config source: ${report.configSource}`,
    `Overrides: ${report.appliedOverrides.join(", ") || "none"}`,
    ...report.checks.map((check) => `[${check.status}] ${check.name}: ${check.message}`),
    "Report: diagnostics/local_model_eval.md",
  ].join("\n");
}

/**
 * Renders the local model evaluation report as operator-facing Markdown.
 *
 * @param report - The completed model evaluation report.
 * @returns Markdown that summarizes parser checks without raw provider output.
 */
export function renderLocalModelEvalMarkdown(report: LocalModelEvalReport): string {
  return [
    "# Local Model Evaluation",
    "",
    `Created: ${report.createdAt}`,
    `Duration: ${report.durationMs} ms`,
    `Provider: ${report.providerMode}`,
    `Model: ${report.configuredModel}`,
    `Config source: ${report.configSource}`,
    `Overrides: ${report.appliedOverrides.join(", ") || "none"}`,
    `Passed: ${report.passed}`,
    "",
    table(
      ["Check", "Status", "Message", "Provider", "Model", "Output hash"],
      report.checks.map((check) => [
        check.name,
        check.status,
        check.message,
        check.provider ?? "n/a",
        check.model ?? "n/a",
        check.outputHash ?? "n/a",
      ]),
    ),
    "",
    "Raw provider output is intentionally not persisted.",
    "",
  ].join("\n");
}
