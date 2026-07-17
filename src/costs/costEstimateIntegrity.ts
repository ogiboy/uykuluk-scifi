import type { ProducerConfig } from "../config/schema.js";
import type { RunRecord } from "../core/state.js";
import { verifyProductionPackage } from "../stages/production/productionPackageIntegrity.js";
import { sha256 } from "../utils/hash.js";
import type { CostEstimate } from "./costEstimateContracts.js";
import { readSettledHostedVisualQuoteStage } from "./costQuoteCompletion.js";
import { quoteCostStages } from "./costQuoteStages.js";

/**
 * Validates that a cost estimate remains consistent with the current run, configuration, and executable cost stages.
 *
 * @param quoteDigest - Optional digest used to preserve a settled hosted visual quote stage during validation.
 * @returns Integrity failure reasons; an empty array indicates that the estimate is current. If current stage pricing cannot be computed, contains a reason describing the validation failure.
 */
export async function validateCostEstimateIntegrity(
  run: RunRecord,
  config: ProducerConfig,
  estimate: CostEstimate,
  quoteDigest?: string,
): Promise<string[]> {
  let currentStages: CostEstimate["stages"];
  try {
    const settledImageGeneration = quoteDigest
      ? await readSettledHostedVisualQuoteStage(run, quoteDigest, estimate.stages)
      : null;
    currentStages = await quoteCostStages(run, config, {
      ...(settledImageGeneration
        ? {
            preserveSettledQuoteStages: {
              stages: estimate.stages,
              stageNames: ["imageGeneration"],
            },
          }
        : {}),
      suppressCompletedPaidStages: estimate.stages.some(
        (stage) => stage.bindingSummary?.kind === "settled-paid-stage",
      ),
    });
  } catch (error) {
    return [
      `Active execution plan could not be validated: ${error instanceof Error ? error.message : String(error)}`,
    ];
  }
  return validateCostEstimateIntegrityWithStages(run, config, estimate, currentStages);
}

/**
 * Validates a cost estimate against run, configuration, budget, and executable-stage evidence.
 *
 * @param estimate - The previously generated cost estimate to validate.
 * @param currentStages - The resolved executable stages used as the current pricing snapshot.
 * @returns Integrity failure reasons; an empty array indicates that the estimate remains valid.
 */
export async function validateCostEstimateIntegrityWithStages(
  run: RunRecord,
  config: ProducerConfig,
  estimate: CostEstimate,
  currentStages: CostEstimate["stages"],
): Promise<string[]> {
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

/**
 * Verifies the run's current production package and returns its canonical digest.
 *
 * @throws SafeExitError When package artifacts are missing, stale, or fail integrity validation.
 */
export async function currentProductionPackageDigest(run: RunRecord): Promise<string> {
  return (await verifyProductionPackage(run)).digest;
}
