import { ProducerConfig } from "../config/schema.js";
import { RunRecord } from "../core/state.js";
import { checkBudget } from "../safeguards/budgetGuard.js";
import { nowIso } from "../utils/time.js";
import { type CostEstimate } from "./costEstimateContracts.js";
import {
  currentProductionPackageDigest,
  relevantConfigDigest,
  stagesDigest,
  validateCostEstimateIntegrityWithStages,
} from "./costEstimateIntegrity.js";
import {
  readCostEstimateAtProjectRoot,
  readCostEstimateByDigestAtProjectRoot,
} from "./costEstimateStore.js";
import { readSettledHostedVisualQuoteStage } from "./costQuoteCompletion.js";
import { quoteCostStages } from "./costQuoteStages.js";

export { costEstimateSchema } from "./costEstimateContracts.js";
export type { CostEstimate } from "./costEstimateContracts.js";
export { readCostEstimateAtProjectRoot, readCostEstimateByDigestAtProjectRoot };

/**
 * Builds a cost estimate using the current run, configuration, budgets, pricing, and production package.
 *
 * @param run - The run for which to calculate the estimate
 * @param config - The producer configuration governing costs and budgets
 * @returns The cost estimate, including budget and approval decisions
 */
export async function buildCostEstimate(
  run: RunRecord,
  config: ProducerConfig,
): Promise<CostEstimate> {
  const stages = await quoteCostStages(run, config, { suppressCompletedPaidStages: true });
  const estimatedStageCost = stages.reduce(
    (sum, stage) => sum + (stage.enabled ? stage.estimatedUsd : 0),
    0,
  );
  const budget = await checkBudget({
    run,
    config,
    stage: "estimate",
    provider: "local-estimator",
    estimatedUsd: estimatedStageCost,
    recordCostEvent: false,
  });
  const approvalRequired =
    budget.approvalRequired || requiresConfiguredProviderApproval(config, stages);
  const hardBlockedReasons = budget.blockedReasons;
  return {
    schemaVersion: 1,
    runId: run.runId,
    generatedAt: nowIso(),
    currency: "USD",
    stages,
    estimatedStageCost,
    cumulativeEstimatedRunCost: budget.cumulativeEstimatedRunCostUsd,
    budgets: config.budgets,
    budgetAllowed: budget.allowed,
    approvalRequired,
    hardBlockedReasons,
    nextStepAllowed: budget.allowed && !approvalRequired,
    blockedReasons: [
      ...hardBlockedReasons,
      ...(approvalRequired ? ["Explicit paid-generation cost approval required."] : []),
    ],
    productionPackageDigest: await currentProductionPackageDigest(run),
    configDigest: relevantConfigDigest(config),
    pricingDigest: stagesDigest(stages),
  };
}

/** Reads a quote and verifies its operator Markdown matches the persisted JSON. */
export async function readCostEstimate(
  runId: string,
): Promise<{ estimate: CostEstimate; text: string; markdownText: string; digest: string }> {
  return readCostEstimateAtProjectRoot(process.cwd(), runId);
}

/**
 * Checks whether a cost estimate remains current against the run, configuration, pricing, and budget state.
 *
 * @param run - The production run associated with the estimate
 * @param config - The producer configuration used for validation
 * @param estimate - The cost estimate to validate
 * @returns Reasons the estimate is stale or inconsistent; an empty array indicates that it remains current
 */
export async function validateCurrentCostEstimate(
  run: RunRecord,
  config: ProducerConfig,
  estimate: CostEstimate,
  quoteDigest?: string,
): Promise<string[]> {
  let currentStages: CostEstimate["stages"];
  let hostedVisualSettlement: { actualUsd: number } | null = null;
  try {
    hostedVisualSettlement = quoteDigest
      ? await readSettledHostedVisualQuoteStage(run, quoteDigest, estimate.stages)
      : null;
    currentStages = await quoteCostStages(run, config, {
      ...(hostedVisualSettlement
        ? {
            preserveSettledQuoteStages: {
              stages: estimate.stages,
              stageNames: ["imageGeneration"],
            },
          }
        : {}),
      suppressCompletedPaidStages: estimateHasCompletedPaidStages(estimate),
    });
  } catch (error) {
    return [
      `Active execution plan could not be validated: ${error instanceof Error ? error.message : String(error)}`,
    ];
  }
  const reasons = await validateCostEstimateIntegrityWithStages(
    run,
    config,
    estimate,
    currentStages,
  );
  const remainingTotal = currentStages.reduce(
    (sum, stage) =>
      sum +
      (stage.enabled && !(hostedVisualSettlement && stage.stage === "imageGeneration")
        ? stage.estimatedUsd
        : 0),
    0,
  );
  const budget = await checkBudget({
    run,
    config,
    stage: "cost-approval-validation",
    provider: "local-estimator",
    estimatedUsd: remainingTotal,
    recordCostEvent: false,
  });
  if (estimate.budgetAllowed !== budget.allowed) {
    reasons.push("Live hard-budget decision changed after the cost estimate.");
  }
  const approvalRequired =
    budget.approvalRequired || requiresConfiguredProviderApproval(config, currentStages);
  if (estimate.approvalRequired !== approvalRequired) {
    reasons.push("Live approval threshold changed after the cost estimate.");
  }
  const hostedVisualQuoteMaximum = hostedVisualSettlement
    ? (estimate.stages.find((stage) => stage.stage === "imageGeneration")?.estimatedUsd ?? 0)
    : 0;
  const expectedCumulativeRunCost = hostedVisualSettlement
    ? estimate.cumulativeEstimatedRunCost -
      hostedVisualQuoteMaximum +
      hostedVisualSettlement.actualUsd
    : estimate.cumulativeEstimatedRunCost;
  if (expectedCumulativeRunCost !== budget.cumulativeEstimatedRunCostUsd) {
    reasons.push("Live cumulative run cost changed after the cost estimate.");
  }
  if (JSON.stringify(estimate.hardBlockedReasons) !== JSON.stringify(budget.blockedReasons)) {
    reasons.push("Live hard-budget reasons changed after the cost estimate.");
  }
  const expectedBlockedReasons = [
    ...budget.blockedReasons,
    ...(approvalRequired ? ["Explicit paid-generation cost approval required."] : []),
  ];
  if (JSON.stringify(estimate.blockedReasons) !== JSON.stringify(expectedBlockedReasons)) {
    reasons.push("Quoted block reasons do not match the current budget decision.");
  }
  if (estimate.nextStepAllowed !== (budget.allowed && !approvalRequired)) {
    reasons.push("Quoted next-step decision does not match the current budget decision.");
  }
  return reasons;
}

function estimateHasCompletedPaidStages(estimate: CostEstimate): boolean {
  return estimate.stages.some((stage) => stage.bindingSummary?.kind === "settled-paid-stage");
}

function requiresConfiguredProviderApproval(
  config: ProducerConfig,
  stages: CostEstimate["stages"],
): boolean {
  return (
    config.providers.imageGeneration.requiresApproval &&
    stages.some((stage) => stage.stage === "imageGeneration" && stage.enabled)
  );
}

/**
 * Checks whether a cost estimate remains structurally consistent with the current run and configuration.
 *
 * @returns A list of integrity failure reasons; an empty array indicates that the estimate is current.
 */
export { validateCostEstimateIntegrity } from "./costEstimateIntegrity.js";
