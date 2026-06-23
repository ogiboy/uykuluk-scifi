import { table } from "../utils/markdown.js";
import type { CostEstimate } from "./costEstimate.js";

/**
 * Renders a cost estimate as a markdown-formatted report.
 *
 * @returns A markdown string containing the cost estimate.
 */
export function renderCostEstimateMarkdown(estimate: CostEstimate): string {
  return [
    "# Cost Estimate",
    "",
    table(
      ["Stage", "Provider", "Enabled", "Estimated USD"],
      estimate.stages.map((stage) => [
        stage.stage,
        stage.provider,
        String(stage.enabled),
        stage.estimatedUsd.toFixed(4),
      ]),
    ),
    "",
    `Cumulative estimated run cost: ${estimate.cumulativeEstimatedRunCost.toFixed(4)} USD`,
    `Per-video budget: ${estimate.budgets.perVideoUsd.toFixed(4)} USD`,
    `Daily budget: ${estimate.budgets.dailyUsd.toFixed(4)} USD`,
    `Weekly budget: ${estimate.budgets.weeklyUsd.toFixed(4)} USD`,
    `Approval required: ${estimate.approvalRequired}`,
    `Next step allowed: ${estimate.nextStepAllowed}`,
    "",
    "## Blocks",
    "",
    estimate.blockedReasons.length
      ? estimate.blockedReasons.map((item) => `- ${item}`).join("\n")
      : "- None",
  ].join("\n");
}
