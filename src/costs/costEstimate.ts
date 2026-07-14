import { readFile } from "node:fs/promises";
import { ProducerConfig } from "../config/schema.js";
import { artifactPathAtProjectRoot } from "../core/artifactPaths.js";
import { SafeExitError } from "../core/errors.js";
import { RunRecord } from "../core/state.js";
import { checkBudget } from "../safeguards/budgetGuard.js";
import { sha256 } from "../utils/hash.js";
import { nowIso } from "../utils/time.js";
import { costEstimateSchema, type CostEstimate } from "./costEstimateContracts.js";
import {
  currentProductionPackageDigest,
  relevantConfigDigest,
  stagesDigest,
  validateCostEstimateIntegrity,
} from "./costEstimateIntegrity.js";
import { renderCostEstimateMarkdown } from "./costEstimatePresentation.js";
import { quoteCostStages } from "./costQuoteStages.js";

export { costEstimateSchema } from "./costEstimateContracts.js";
export type { CostEstimate } from "./costEstimateContracts.js";

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
  const stages = await quoteCostStages(run, config);
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
  const approvalRequired = budget.approvalRequired;
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

/** Reads and verifies a quote beneath an explicit producer project root. */
export async function readCostEstimateAtProjectRoot(
  projectRoot: string,
  runId: string,
): Promise<{ estimate: CostEstimate; text: string; markdownText: string; digest: string }> {
  const text = await readFile(
    artifactPathAtProjectRoot(projectRoot, runId, "costs/estimate.json"),
    "utf8",
  );
  const markdownText = await readFile(
    artifactPathAtProjectRoot(projectRoot, runId, "costs/estimate.md"),
    "utf8",
  );
  const estimate = costEstimateSchema.parse(JSON.parse(text) as unknown);
  const expectedMarkdown = `${renderCostEstimateMarkdown(estimate)}\n`;
  if (markdownText !== expectedMarkdown) {
    throw new SafeExitError("Cost quote Markdown does not match the persisted JSON quote.");
  }
  return { estimate, text, markdownText, digest: sha256(`${text}\0${markdownText}`) };
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
): Promise<string[]> {
  const reasons = await validateCostEstimateIntegrity(run, config, estimate);
  const currentStages = await quoteCostStages(run, config);
  const currentTotal = currentStages.reduce(
    (sum, stage) => sum + (stage.enabled ? stage.estimatedUsd : 0),
    0,
  );
  const budget = await checkBudget({
    run,
    config,
    stage: "cost-approval-validation",
    provider: "local-estimator",
    estimatedUsd: currentTotal,
    recordCostEvent: false,
  });
  if (estimate.budgetAllowed !== budget.allowed) {
    reasons.push("Live hard-budget decision changed after the cost estimate.");
  }
  if (estimate.approvalRequired !== budget.approvalRequired) {
    reasons.push("Live approval threshold changed after the cost estimate.");
  }
  if (estimate.cumulativeEstimatedRunCost !== budget.cumulativeEstimatedRunCostUsd) {
    reasons.push("Live cumulative run cost changed after the cost estimate.");
  }
  if (JSON.stringify(estimate.hardBlockedReasons) !== JSON.stringify(budget.blockedReasons)) {
    reasons.push("Live hard-budget reasons changed after the cost estimate.");
  }
  const expectedBlockedReasons = [
    ...budget.blockedReasons,
    ...(budget.approvalRequired ? ["Explicit paid-generation cost approval required."] : []),
  ];
  if (JSON.stringify(estimate.blockedReasons) !== JSON.stringify(expectedBlockedReasons)) {
    reasons.push("Quoted block reasons do not match the current budget decision.");
  }
  if (estimate.nextStepAllowed !== (budget.allowed && !budget.approvalRequired)) {
    reasons.push("Quoted next-step decision does not match the current budget decision.");
  }
  return reasons;
}

/**
 * Checks whether a cost estimate remains structurally consistent with the current run and configuration.
 *
 * @returns A list of integrity failure reasons; an empty array indicates that the estimate is current.
 */
export { validateCostEstimateIntegrity } from "./costEstimateIntegrity.js";
