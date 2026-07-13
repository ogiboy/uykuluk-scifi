import { readFile } from "node:fs/promises";
import type { ProducerConfig } from "../config/schema.js";
import { artifactPath } from "../core/artifacts.js";
import type { RunRecord } from "../core/state.js";
import { splitElevenLabsText } from "../stages/voice/elevenLabsTextChunks.js";
import { buildSelectedVoiceExecutionBinding } from "../stages/voice/voiceExecutionBinding.js";
import { prepareVoiceoverText } from "../stages/voice/voiceoverPreparation.js";
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
): Promise<Array<StagePricing & { enabled: boolean }>> {
  const stages = Object.values(defaultStagePricing).map((pricing) => ({
    ...pricing,
    enabled: isStageEnabled(pricing.stage, config),
  }));
  if (!config.providers.tts.enabled || config.providers.tts.mode !== "elevenlabs") {
    return stages;
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
    case "videoGeneration":
      return config.providers.imageGeneration.enabled;
    case "upload":
      return config.providers.youtube.enabled;
    default:
      return true;
  }
}
