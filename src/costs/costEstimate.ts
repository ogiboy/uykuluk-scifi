import { ProducerConfig } from "../config/schema.js";
import { loadRun } from "../core/runStore.js";
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
import { readCostEstimateAtProjectRoot } from "./costEstimateStore.js";
import {
  readSettledHostedVisualQuoteStage,
  readSettledTtsQuoteStage,
} from "./costQuoteCompletion.js";
import { quoteCostStages } from "./costQuoteStages.js";
import { usdToMicros } from "./money.js";

export { costEstimateSchema } from "./costEstimateContracts.js";
export type { CostEstimate } from "./costEstimateContracts.js";
export { readCostEstimateByDigestAtProjectRoot } from "./costEstimateStore.js";
export { readCostEstimateAtProjectRoot };

/**
 * Builds the run's current cost estimate and determines whether the next paid-generation step is allowed.
 *
 * @param run - The run whose stages and production package are evaluated
 * @param config - Configuration containing pricing, provider approval requirements, and budget limits
 * @returns The cost estimate with stage costs, budget decisions, approval requirements, blocking reasons, and digests
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

/**
 * Reads the persisted cost estimate for a run and verifies its serialized representations.
 *
 * @param runId - Identifier of the run whose cost estimate should be read
 * @returns The parsed estimate, persisted text, operator-facing Markdown, and content digest
 */
export async function readCostEstimate(
  runId: string,
): Promise<{ estimate: CostEstimate; text: string; markdownText: string; digest: string }> {
  return readCostEstimateAtProjectRoot(process.cwd(), await loadRun(runId));
}

/**
 * Validates a cost estimate against the current execution plan, pricing, approval requirements, and budget state.
 *
 * @param run - The production run associated with the estimate
 * @param config - The producer configuration used for validation
 * @param estimate - The cost estimate to validate
 * @param quoteDigest - Optional digest identifying settled quote-stage evidence to include in validation
 * @returns Reasons the estimate is stale or inconsistent; an empty array indicates that it remains current. Validation failures are returned as reasons.
 */
export async function validateCurrentCostEstimate(
  run: RunRecord,
  config: ProducerConfig,
  estimate: CostEstimate,
  quoteDigest?: string,
): Promise<string[]> {
  const settledStages = new Map<string, { actualUsdMicros: number }>();
  let currentStages: CostEstimate["stages"];
  try {
    await collectSettledQuoteStages(run, estimate, quoteDigest, settledStages);
    currentStages = await quoteCurrentStages(run, config, estimate, settledStages);
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
  const remainingTotal = remainingQuotedCost(currentStages, settledStages);
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
    budget.approvalRequired ||
    requiresConfiguredProviderApproval(config, currentStages) ||
    (settledStages.size > 0 && estimate.approvalRequired);
  if (estimate.approvalRequired !== approvalRequired) {
    reasons.push("Live approval threshold changed after the cost estimate.");
  }
  const expectedCumulativeMicros = expectedCumulativeCostMicros(estimate, settledStages);
  if (expectedCumulativeMicros !== usdToMicros(budget.cumulativeEstimatedRunCostUsd)) {
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

async function collectSettledQuoteStages(
  run: RunRecord,
  estimate: CostEstimate,
  quoteDigest: string | undefined,
  settledStages: Map<string, { actualUsdMicros: number }>,
): Promise<void> {
  if (!quoteDigest) return;
  const [tts, imageGeneration] = await Promise.all([
    readSettledTtsQuoteStage(run, quoteDigest, estimate.stages),
    readSettledHostedVisualQuoteStage(run, quoteDigest, estimate.stages),
  ]);
  if (tts) settledStages.set("tts", tts);
  if (imageGeneration) settledStages.set("imageGeneration", imageGeneration);
}

async function quoteCurrentStages(
  run: RunRecord,
  config: ProducerConfig,
  estimate: CostEstimate,
  settledStages: Map<string, { actualUsdMicros: number }>,
): Promise<CostEstimate["stages"]> {
  return quoteCostStages(run, config, {
    ...(settledStages.has("imageGeneration")
      ? { preserveSettledQuoteStages: { stages: estimate.stages, stageNames: ["imageGeneration"] } }
      : {}),
    suppressCompletedPaidStages: estimateHasCompletedPaidStages(estimate),
  });
}

function remainingQuotedCost(
  currentStages: CostEstimate["stages"],
  settledStages: Map<string, { actualUsdMicros: number }>,
): number {
  return currentStages.reduce(
    (sum, stage) =>
      sum + (stage.enabled && !settledStages.has(stage.stage) ? stage.estimatedUsd : 0),
    0,
  );
}

function expectedCumulativeCostMicros(
  estimate: CostEstimate,
  settledStages: Map<string, { actualUsdMicros: number }>,
): number {
  return [...settledStages.entries()].reduce((total, [stageName, settlement]) => {
    const quotedMaximum =
      estimate.stages.find((stage) => stage.stage === stageName)?.estimatedUsd ?? 0;
    return total - usdToMicros(quotedMaximum) + settlement.actualUsdMicros;
  }, usdToMicros(estimate.cumulativeEstimatedRunCost));
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
