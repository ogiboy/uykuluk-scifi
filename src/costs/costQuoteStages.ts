import { readFile } from "node:fs/promises";
import type { ProducerConfig } from "../config/schema.js";
import { artifactPath } from "../core/artifacts.js";
import type { RunRecord } from "../core/state.js";
import { loadHostedVisualGenerationPlan } from "../stages/visuals/visualGenerationPlanStore.js";
import { splitElevenLabsText } from "../stages/voice/elevenLabsTextChunks.js";
import { buildSelectedVoiceExecutionBinding } from "../stages/voice/voiceExecutionBinding.js";
import { prepareVoiceoverText } from "../stages/voice/voiceoverPreparation.js";
import { suppressSettledTtsStage } from "./costQuoteCompletion.js";
import { estimateElevenLabsMaximumTtsUsd } from "./elevenLabsPricing.js";
import { defaultStagePricing, type StagePricing } from "./pricing.js";

/**
 * Builds stage pricing entries with provider-based enablement and optional run-specific ElevenLabs TTS pricing.
 *
 * @param run - The run whose voiceover artifact is used to estimate TTS cost
 * @param config - Provider configuration used to determine enabled stages and TTS pricing
 * @returns Stage pricing entries, including an estimated maximum cost for ElevenLabs TTS when configured
 */
export async function quoteCostStages(
  run: RunRecord,
  config: ProducerConfig,
  options: {
    preserveSettledQuoteStages?: Readonly<{
      stages: readonly (StagePricing & { enabled: boolean })[];
      stageNames: readonly string[];
    }>;
    suppressCompletedPaidStages?: boolean;
  } = {},
): Promise<Array<StagePricing & { enabled: boolean }>> {
  let stages = Object.values(defaultStagePricing).map((pricing) => ({
    ...pricing,
    enabled: isStageEnabled(pricing.stage, config),
  }));
  if (
    config.providers.imageGeneration.enabled &&
    config.providers.imageGeneration.mode === "black-forest-labs"
  ) {
    const settledSnapshot = options.preserveSettledQuoteStages?.stageNames.includes(
      "imageGeneration",
    )
      ? options.preserveSettledQuoteStages.stages.find((stage) => stage.stage === "imageGeneration")
      : undefined;
    if (settledSnapshot) {
      stages = stages.map((stage) =>
        stage.stage === "imageGeneration" ? { ...settledSnapshot } : stage,
      );
    } else {
      const loaded = await loadHostedVisualGenerationPlan(run, config);
      const { plan } = loaded;
      stages = stages.map((stage) =>
        stage.stage === "imageGeneration"
          ? {
              stage: "imageGeneration",
              provider: plan.provider,
              model: plan.model,
              bindingDigest: loaded.digest,
              bindingSummary: {
                kind: "hosted-visual-generation" as const,
                planDigest: loaded.digest,
                visualManifestDigest: plan.visualManifest.digest,
                pricingDigest: plan.pricing.digest,
                targetedSceneIndexes: plan.targetedSceneIndexes,
                maximumUsdPerImage: plan.pricing.maximumUsdPerImage,
                totalMaximumUsd: plan.totalMaximumUsd,
              },
              enabled: true,
              estimatedUsd: plan.totalMaximumUsd,
            }
          : stage,
      );
    }
  }
  if (!config.providers.tts.enabled || config.providers.tts.mode !== "elevenlabs") {
    return stages;
  }
  if (options.suppressCompletedPaidStages) {
    const completed = await suppressSettledTtsStage(run, stages);
    if (
      completed.find((stage) => stage.stage === "tts")?.bindingSummary?.kind ===
      "settled-paid-stage"
    ) {
      return completed;
    }
  }
  const voiceover = await readFile(artifactPath(run.runId, "production/voiceover.txt"), "utf8");
  const prepared = prepareVoiceoverText({
    runId: run.runId,
    sourceText: voiceover,
    pronunciationReplacements: config.providers.tts.pronunciationReplacements,
  });
  const binding = await buildSelectedVoiceExecutionBinding({
    runId: run.runId,
    config,
    preparedText: prepared.text,
  });
  return stages.map((stage) =>
    stage.stage === "tts"
      ? {
          stage: "tts",
          provider: "elevenlabs",
          model: binding.model.modelId,
          bindingDigest: binding.bindingDigest,
          bindingSummary: {
            kind: "selected-voice",
            selectionDigest: binding.selection.digest,
            voiceId: binding.voice.voiceId,
            modelId: binding.model.modelId,
            pricingDigest: binding.pricing.digest,
            expectedUsdPerThousandCharacters: binding.pricing.effectiveUsdPerThousandCharacters,
            maximumUsdPerThousandCharacters: binding.pricing.maximumUsdPerThousandCharacters,
          },
          enabled: true,
          estimatedUsd: estimateElevenLabsMaximumTtsUsd({
            chunkCharacterCounts: splitElevenLabsText(
              prepared.text,
              binding.synthesis.maxCharactersPerRequest,
            ).map((chunk) => chunk.length),
            baseUsdPerThousandCharacters: binding.pricing.baseUsdPerThousandCharacters,
            characterCostMultiplier: binding.pricing.characterCostMultiplier,
            costDiscountMultiplier: binding.pricing.costDiscountMultiplier,
          }),
        }
      : stage,
  );
}

/**
 * Determines whether a production stage is enabled by the provider configuration.
 *
 * @param stage - The stage whose enabled status to determine
 * @returns `true` if the stage's provider is enabled or the stage has no provider-specific setting, `false` otherwise
 */
function isStageEnabled(stage: string, config: ProducerConfig): boolean {
  switch (stage) {
    case "tts":
      return config.providers.tts.enabled;
    case "imageGeneration":
      return (
        config.providers.imageGeneration.enabled &&
        config.providers.imageGeneration.mode === "black-forest-labs"
      );
    case "videoGeneration":
      return false;
    case "upload":
      return config.providers.youtube.enabled;
    default:
      return true;
  }
}
