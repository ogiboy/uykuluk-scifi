import { loadConfig } from "../config/config.js";
import { RunRecord } from "../core/state.js";
import { readVoiceoverAudioEvidence } from "./voiceoverEvidence.js";
import type { ReadinessCheck } from "./readiness.js";

export async function voiceoverReadinessCheck(run: RunRecord): Promise<ReadinessCheck> {
  const evidence = await readVoiceoverAudioEvidence(run);
  if (evidence.status === "pass") {
    return {
      name: "voiceover audio available",
      status: "pass",
      message: `${evidence.path} exists with ${Math.round(evidence.durationSeconds)}s ${evidence.mode} audio.`,
    };
  }
  if (evidence.status === "missing") {
    const config = await loadConfig();
    return {
      name: "voiceover audio available",
      status: "warn",
      message: "Voiceover audio is not generated yet; generate it before FFmpeg render work.",
      nextAction: config.providers.tts.enabled
        ? `pnpm producer voice --run ${run.runId}`
        : `Enable local TTS in producer.config.json, then pnpm producer voice --run ${run.runId}`,
    };
  }
  return {
    name: "voiceover audio available",
    status: "block",
    message: evidence.message,
  };
}
