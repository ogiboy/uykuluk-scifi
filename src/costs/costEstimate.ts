import { readFile } from "node:fs/promises";
import { z } from "zod";
import { ProducerConfig } from "../config/schema.js";
import { artifactPath } from "../core/artifacts.js";
import { SafeExitError } from "../core/errors.js";
import { RunRecord } from "../core/state.js";
import { checkBudget } from "../safeguards/budgetGuard.js";
import { verifyProductionPackage } from "../stages/production/productionPackageIntegrity.js";
import { sha256 } from "../utils/hash.js";
import { nowIso } from "../utils/time.js";
import { costBindingSummarySchema } from "./costBindingSummary.js";
import { renderCostEstimateMarkdown } from "./costEstimatePresentation.js";
import { quoteCostStages } from "./costQuoteStages.js";
import { executionBindingDigestSchema } from "./providerAdapterIdentity.js";

const budgetSnapshotSchema = z.strictObject({
  perVideoUsd: z.number().nonnegative(),
  dailyUsd: z.number().nonnegative(),
  weeklyUsd: z.number().nonnegative(),
  requireApprovalAboveUsd: z.number().nonnegative(),
});

const quotedStageSchema = z.strictObject({
  stage: z.string().min(1),
  provider: z.string().min(1),
  model: z.string().min(1).optional(),
  bindingDigest: executionBindingDigestSchema.optional(),
  bindingSummary: costBindingSummarySchema.optional(),
  enabled: z.boolean(),
  estimatedUsd: z.number().nonnegative(),
});

export const costEstimateSchema = z.strictObject({
  schemaVersion: z.literal(1),
  runId: z.string().min(1),
  generatedAt: z.iso.datetime(),
  currency: z.literal("USD"),
  stages: z.array(quotedStageSchema),
  estimatedStageCost: z.number().nonnegative(),
  cumulativeEstimatedRunCost: z.number().nonnegative(),
  budgets: budgetSnapshotSchema,
  budgetAllowed: z.boolean(),
  approvalRequired: z.boolean(),
  hardBlockedReasons: z.array(z.string()),
  nextStepAllowed: z.boolean(),
  blockedReasons: z.array(z.string()),
  productionPackageDigest: z.string().regex(/^[a-f0-9]{64}$/),
  configDigest: z.string().regex(/^[a-f0-9]{64}$/),
  pricingDigest: z.string().regex(/^[a-f0-9]{64}$/),
});

export type CostEstimate = z.infer<typeof costEstimateSchema>;

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
  const text = await readFile(artifactPath(runId, "costs/estimate.json"), "utf8");
  const markdownText = await readFile(artifactPath(runId, "costs/estimate.md"), "utf8");
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
export async function validateCostEstimateIntegrity(
  run: RunRecord,
  config: ProducerConfig,
  estimate: CostEstimate,
): Promise<string[]> {
  const currentStages = await quoteCostStages(run, config);
  const reasons: string[] = [];
  if (estimate.runId !== run.runId) {
    reasons.push("Cost estimate belongs to a different run.");
  }
  if (estimate.productionPackageDigest !== (await currentProductionPackageDigest(run))) {
    reasons.push("Production package changed after the cost estimate.");
  }
  if (estimate.configDigest !== relevantConfigDigest(config)) {
    reasons.push("Relevant provider or budget config changed after the cost estimate.");
  }
  if (estimate.pricingDigest !== stagesDigest(estimate.stages)) {
    reasons.push("Quoted stage details do not match the quote pricing digest.");
  }
  if (estimate.pricingDigest !== stagesDigest(currentStages)) {
    reasons.push("Stage pricing changed after the cost estimate.");
  }
  if (
    JSON.stringify(canonicalStages(estimate.stages)) !==
    JSON.stringify(canonicalStages(currentStages))
  ) {
    reasons.push("Quoted stages no longer match current enabled stage pricing.");
  }
  if (JSON.stringify(estimate.budgets) !== JSON.stringify(config.budgets)) {
    reasons.push("Quoted budget snapshot no longer matches current budgets.");
  }
  const currentTotal = currentStages.reduce(
    (sum, stage) => sum + (stage.enabled ? stage.estimatedUsd : 0),
    0,
  );
  if (estimate.estimatedStageCost !== currentTotal) {
    reasons.push("Quoted total no longer matches current enabled stage pricing.");
  }
  return reasons;
}

/**
 * Computes a digest of configuration values relevant to cost estimation and execution.
 *
 * @param config - The producer configuration to summarize
 * @returns A SHA-256 digest of the relevant provider and budget settings
 */
function relevantConfigDigest(config: ProducerConfig): string {
  return sha256(
    JSON.stringify({
      providers: {
        tts: executionRelevantTtsConfig(config),
        imageGeneration: config.providers.imageGeneration,
        youtube: config.providers.youtube,
      },
      budgets: config.budgets,
    }),
  );
}

/**
 * Creates the TTS configuration used for execution-relevant comparisons.
 *
 * @param config - Producer configuration containing the TTS provider settings
 * @returns A TTS configuration with the ElevenLabs voice ID omitted
 */
function executionRelevantTtsConfig(config: ProducerConfig) {
  const elevenLabs = { ...config.providers.tts.elevenLabs };
  delete elevenLabs.voiceId;
  return { ...config.providers.tts, elevenLabs };
}

/**
 * Computes a digest for a canonicalized list of quoted cost stages.
 *
 * @param stages - The quoted cost stages to digest
 * @returns A SHA-256 digest of the canonicalized stages
 */
function stagesDigest(stages: CostEstimate["stages"]): string {
  return sha256(JSON.stringify(canonicalStages(stages)));
}

/**
 * Normalizes quoted stages into a consistent field order and structure.
 *
 * @param stages - The quoted stages to canonicalize
 * @returns Canonicalized quoted stages with optional model and binding metadata preserved
 */
function canonicalStages(stages: CostEstimate["stages"]): CostEstimate["stages"] {
  return stages.map((stage) => ({
    stage: stage.stage,
    provider: stage.provider,
    ...(stage.model ? { model: stage.model } : {}),
    ...(stage.bindingDigest ? { bindingDigest: stage.bindingDigest } : {}),
    ...(stage.bindingSummary ? { bindingSummary: stage.bindingSummary } : {}),
    enabled: stage.enabled,
    estimatedUsd: stage.estimatedUsd,
  }));
}

async function currentProductionPackageDigest(run: RunRecord): Promise<string> {
  return (await verifyProductionPackage(run)).digest;
}
