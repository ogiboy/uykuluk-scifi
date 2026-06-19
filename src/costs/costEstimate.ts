import { readFile } from "node:fs/promises";
import { z } from "zod";
import { ProducerConfig } from "../config/schema";
import { artifactPath } from "../core/artifacts";
import { SafeExitError } from "../core/errors";
import { RunRecord } from "../core/state";
import { checkBudget } from "../safeguards/budgetGuard";
import { verifyProductionPackage } from "../stages/productionPackageIntegrity";
import { sha256 } from "../utils/hash";
import { nowIso } from "../utils/time";
import { renderCostEstimateMarkdown } from "./costEstimatePresentation";
import { defaultStagePricing, StagePricing } from "./pricing";

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

/** Builds a cost quote bound to current budgets, config, pricing, and package integrity. */
export async function buildCostEstimate(
  run: RunRecord,
  config: ProducerConfig,
): Promise<CostEstimate> {
  const stages = quoteStages(config);
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
export async function readCostEstimate(runId: string): Promise<{
  estimate: CostEstimate;
  text: string;
  markdownText: string;
  digest: string;
}> {
  const text = await readFile(artifactPath(runId, "costs/estimate.json"), "utf8");
  const markdownText = await readFile(artifactPath(runId, "costs/estimate.md"), "utf8");
  const estimate = costEstimateSchema.parse(JSON.parse(text) as unknown);
  const expectedMarkdown = `${renderCostEstimateMarkdown(estimate)}\n`;
  if (markdownText !== expectedMarkdown) {
    throw new SafeExitError("Cost quote Markdown does not match the persisted JSON quote.");
  }
  return {
    estimate,
    text,
    markdownText,
    digest: sha256(`${text}\0${markdownText}`),
  };
}

/** Returns all package, config, pricing, and live-budget reasons that make a quote stale. */
export async function validateCurrentCostEstimate(
  run: RunRecord,
  config: ProducerConfig,
  estimate: CostEstimate,
): Promise<string[]> {
  const reasons = await validateCostEstimateIntegrity(run, config, estimate);
  const currentStages = quoteStages(config);
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

/** Returns structural quote-integrity failures; an empty array means the quote is current. */
export async function validateCostEstimateIntegrity(
  run: RunRecord,
  config: ProducerConfig,
  estimate: CostEstimate,
): Promise<string[]> {
  const currentStages = quoteStages(config);
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

function quoteStages(config: ProducerConfig): Array<StagePricing & { enabled: boolean }> {
  return Object.values(defaultStagePricing).map((pricing) => {
    let enabled: boolean;
    if (pricing.stage === "tts") {
      enabled = config.providers.tts.enabled;
    } else if (pricing.stage === "imageGeneration" || pricing.stage === "videoGeneration") {
      enabled = config.providers.imageGeneration.enabled;
    } else if (pricing.stage === "upload") {
      enabled = config.providers.youtube.enabled;
    } else {
      enabled = true;
    }

    return {
      ...pricing,
      enabled,
    };
  });
}

function relevantConfigDigest(config: ProducerConfig): string {
  return sha256(
    JSON.stringify({
      providers: {
        tts: config.providers.tts,
        imageGeneration: config.providers.imageGeneration,
        youtube: config.providers.youtube,
      },
      budgets: config.budgets,
    }),
  );
}

function stagesDigest(stages: CostEstimate["stages"]): string {
  return sha256(JSON.stringify(canonicalStages(stages)));
}

function canonicalStages(stages: CostEstimate["stages"]): CostEstimate["stages"] {
  return stages.map((stage) => ({
    stage: stage.stage,
    provider: stage.provider,
    ...(stage.model ? { model: stage.model } : {}),
    enabled: stage.enabled,
    estimatedUsd: stage.estimatedUsd,
  }));
}

async function currentProductionPackageDigest(run: RunRecord): Promise<string> {
  return (await verifyProductionPackage(run)).digest;
}
