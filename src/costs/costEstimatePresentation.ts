import { table } from "../utils/markdown.js";
import type { CostEstimate } from "./costEstimate.js";

/**
 * Renders a cost estimate as a markdown-formatted report.
 *
 * @returns A markdown string containing the cost estimate.
 */
export function renderCostEstimateMarkdown(estimate: CostEstimate): string {
  const sections = [
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
  ];
  const boundStages = estimate.stages.filter((stage) => stage.bindingDigest);
  if (boundStages.length > 0) {
    sections.push(
      "",
      "## Execution Bindings",
      "",
      ...boundStages.map((stage) => `- ${stage.stage}: \`${stage.bindingDigest}\``),
    );
    for (const stage of boundStages) {
      if (!stage.bindingSummary) continue;
      if (stage.bindingSummary.kind === "selected-voice") {
        sections.push(
          "",
          `### ${stage.stage} selected voice`,
          "",
          `- Selection digest: \`${stage.bindingSummary.selectionDigest}\``,
          `- Voice ID: \`${stage.bindingSummary.voiceId}\``,
          `- Model ID: \`${stage.bindingSummary.modelId}\``,
          `- Pricing digest: \`${stage.bindingSummary.pricingDigest}\``,
          `- Expected discounted rate: ${stage.bindingSummary.expectedUsdPerThousandCharacters.toFixed(6)} USD / 1K characters`,
          `- Approved maximum rate: ${stage.bindingSummary.maximumUsdPerThousandCharacters.toFixed(6)} USD / 1K characters`,
        );
      } else if (stage.bindingSummary.kind === "hosted-visual-generation") {
        sections.push(
          "",
          `### ${stage.stage} hosted visual generation`,
          "",
          `- Plan digest: \`${stage.bindingSummary.planDigest}\``,
          `- Visual manifest digest: \`${stage.bindingSummary.visualManifestDigest}\``,
          `- Pricing digest: \`${stage.bindingSummary.pricingDigest}\``,
          `- Targeted scenes: ${stage.bindingSummary.targetedSceneIndexes.join(", ")}`,
          `- Maximum per image: ${stage.bindingSummary.maximumUsdPerImage.toFixed(6)} USD`,
          `- Total maximum: ${stage.bindingSummary.totalMaximumUsd.toFixed(6)} USD`,
        );
      } else {
        sections.push(
          "",
          `### ${stage.stage} settled paid stage`,
          "",
          `- Original quote digest: \`${stage.bindingSummary.originalQuoteDigest}\``,
          `- Original approval: \`${stage.bindingSummary.originalApprovalId}\``,
          `- Reservation: \`${stage.bindingSummary.reservationId}\``,
          `- Result evidence: \`${stage.bindingSummary.resultEvidenceDigest}\``,
          `- Settled actual: ${(stage.bindingSummary.actualUsdMicros / 1_000_000).toFixed(6)} USD`,
        );
      }
    }
  }
  return sections.join("\n");
}
