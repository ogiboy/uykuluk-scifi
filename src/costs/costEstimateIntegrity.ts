import type { ProducerConfig } from "../config/schema.js";
import type { RunRecord } from "../core/state.js";
import { verifyProductionPackage } from "../stages/production/productionPackageIntegrity.js";
import { sha256 } from "../utils/hash.js";
import type { CostEstimate } from "./costEstimateContracts.js";
import { quoteCostStages } from "./costQuoteStages.js";

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
export function relevantConfigDigest(config: ProducerConfig): string {
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
export function stagesDigest(stages: CostEstimate["stages"]): string {
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

export async function currentProductionPackageDigest(run: RunRecord): Promise<string> {
  return (await verifyProductionPackage(run)).digest;
}
