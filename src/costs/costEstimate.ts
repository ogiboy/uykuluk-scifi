import { readFile } from "node:fs/promises";
import { z } from "zod";
import { ProducerConfig } from "../config/schema";
import { artifactPath } from "../core/artifacts";
import { SafeExitError } from "../core/errors";
import { RunRecord } from "../core/state";
import { checkBudget } from "../safeguards/budgetGuard";
import { sha256 } from "../utils/hash";
import { nowIso } from "../utils/time";
import { renderCostEstimateMarkdown } from "./costEstimatePresentation";
import { defaultStagePricing, StagePricing } from "./pricing";

const budgetSnapshotSchema = z
  .object({
    perVideoUsd: z.number().nonnegative(),
    dailyUsd: z.number().nonnegative(),
    weeklyUsd: z.number().nonnegative(),
    requireApprovalAboveUsd: z.number().nonnegative(),
  })
  .strict();

const quotedStageSchema = z
  .object({
    stage: z.string().min(1),
    provider: z.string().min(1),
    model: z.string().min(1).optional(),
    enabled: z.boolean(),
    estimatedUsd: z.number().nonnegative(),
  })
  .strict();

export const costEstimateSchema = z
  .object({
    schemaVersion: z.literal(1),
    runId: z.string().min(1),
    generatedAt: z.string().min(1),
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
  })
  .strict();

export type CostEstimate = z.infer<typeof costEstimateSchema>;

/**
 * Generates a cost estimate based on current stage pricing and budget constraints.
 *
 * Creates an estimate artifact containing stage costs, budget and approval decisions,
 * blocked reasons, and integrity digests for the production package, configuration,
 * and pricing.
 *
 * @param run - The current run record
 * @param config - The producer configuration
 * @returns A cost estimate with stage quotations, budget decisions, and digests
 */
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
    productionPackageDigest: await currentProductionPackageDigest(run.runId),
    configDigest: relevantConfigDigest(config),
    pricingDigest: stagesDigest(stages),
  };
}

/**
 * Reads and validates a persisted cost estimate, ensuring the markdown rendering matches the saved JSON.
 *
 * @returns An object containing the parsed estimate, raw JSON and markdown text, and their combined SHA-256 digest.
 * @throws If the persisted markdown does not match the re-rendered markdown.
 */
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

/**
 * Validates that a saved cost estimate reflects the current runtime and configuration state.
 *
 * Checks both structural integrity (production package, configuration, and pricing digests) and decision parity (budget constraints, approval requirements, and derived costs).
 *
 * @param run - The current run record
 * @param config - The current producer configuration
 * @param estimate - The saved cost estimate to validate
 * @returns An array of reason strings describing discrepancies between the saved estimate and current state; empty if the estimate remains current
 */
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

/**
 * Validates that a cost estimate remains consistent with current runtime state and configuration.
 *
 * @returns An array of human-readable reasons for any detected inconsistencies. Empty if the estimate is valid.
 */
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
  if (estimate.productionPackageDigest !== (await currentProductionPackageDigest(run.runId))) {
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
 * Derives stage quotes with enabled flags based on provider configuration.
 *
 * @returns An array of stage pricing entries with enabled status derived from the provider configuration.
 */
function quoteStages(config: ProducerConfig): Array<StagePricing & { enabled: boolean }> {
  return Object.values(defaultStagePricing).map((pricing) => ({
    ...pricing,
    enabled: isStageEnabled(pricing.stage, config),
  }));
}

/**
 * Determines if a stage is enabled based on provider configuration.
 *
 * @param stage - The stage identifier
 * @param config - The producer configuration
 * @returns True if the stage is enabled, false otherwise
 */
function isStageEnabled(stage: string, config: ProducerConfig): boolean {
  switch (stage) {
    case "tts":
      return config.providers.tts.enabled;
    case "imageGeneration":
    case "videoGeneration":
      return config.providers.imageGeneration.enabled;
    case "upload":
      return config.providers.youtube.enabled;
    default:
      return true;
  }
}

/**
 * Computes a digest of the relevant provider and budget configuration.
 *
 * @returns A SHA-256 hex digest of the configuration settings.
 */
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

/**
 * Computes a SHA-256 digest of the cost estimate stages.
 *
 * @returns A hexadecimal string representing the SHA-256 digest of the normalized stages.
 */
function stagesDigest(stages: CostEstimate["stages"]): string {
  return sha256(JSON.stringify(canonicalStages(stages)));
}

/**
 * Normalizes stages to include only essential fields in a consistent order.
 *
 * @returns A normalized stages array with only `stage`, `provider`, optional `model`, `enabled`, and `estimatedUsd` fields.
 */
function canonicalStages(stages: CostEstimate["stages"]): CostEstimate["stages"] {
  return stages.map((stage) => ({
    stage: stage.stage,
    provider: stage.provider,
    ...(stage.model ? { model: stage.model } : {}),
    enabled: stage.enabled,
    estimatedUsd: stage.estimatedUsd,
  }));
}

/**
 * Computes the SHA-256 digest of the production package.
 *
 * Hashes all active production artifacts in canonical sorted order to bind the cost quote
 * to the complete package artifact set, not just the markdown summary.
 *
 * @param runId - The run identifier
 * @returns The SHA-256 digest as a hexadecimal string
 */
async function currentProductionPackageDigest(runId: string): Promise<string> {
  const artifacts = [
    "production/production_package.md",
    "production/scenes.json",
    "production/subtitles.srt",
    "production/voiceover.txt",
    "production/youtube_metadata.json",
  ].sort();
  const contents = await Promise.all(
    artifacts.map(async (artifact) => {
      const content = await readFile(artifactPath(runId, artifact), "utf8");
      return `${artifact}\0${content}`;
    }),
  );
  return sha256(contents.join("\0"));
}
