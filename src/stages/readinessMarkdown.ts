import { bulletList, table } from "../utils/markdown.js";
import type { ReadinessCheck } from "./readiness.js";

/**
 * Renders the operator-facing readiness markdown report.
 *
 * @param runId - The run identifier.
 * @param passed - Whether readiness passed.
 * @param checks - The readiness checks to summarize.
 * @returns Markdown content for `diagnostics/readiness.md`.
 */
export function renderReadinessMarkdown(
  runId: string,
  passed: boolean,
  checks: readonly ReadinessCheck[],
): string {
  return [
    "# Readiness",
    "",
    `Run: ${runId}`,
    `Passed: ${passed}`,
    "",
    table(
      ["Check", "Status", "Message", "Next action"],
      checks.map((check) => [
        check.name,
        check.status,
        check.message.replaceAll("|", "/"),
        check.nextAction?.replaceAll("|", "/") ?? "None",
      ]),
    ),
    "",
    "## Warnings",
    "",
    bulletList(
      checks
        .filter((check) => check.status === "warn")
        .map((check) => `${check.name}: ${check.message}`),
    ),
  ].join("\n");
}
