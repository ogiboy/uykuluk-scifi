import { readFile } from "node:fs/promises";
import type { ProducerConfig } from "../config/schema.js";
import { artifactPath } from "../core/artifacts.js";
import type { RunRecord } from "../core/state.js";
import { prepareVoiceoverText } from "../stages/voice/voiceoverPreparation.js";
import { estimateElevenLabsTtsUsd } from "./elevenLabsPricing.js";
import { defaultStagePricing, type StagePricing } from "./pricing.js";

/** Builds enabled stage quote lines, including run-specific hosted TTS character pricing. */
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
  return stages.map((stage) =>
    stage.stage === "tts"
      ? {
          stage: "tts",
          provider: "elevenlabs",
          model: config.providers.tts.elevenLabs.modelId,
          enabled: true,
          estimatedUsd: estimateElevenLabsTtsUsd(
            prepared.text,
            config.providers.tts.elevenLabs.usdPerThousandCharacters,
          ),
        }
      : stage,
  );
}

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
