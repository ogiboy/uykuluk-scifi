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
    return {
      name: "voiceover audio available",
      status: "warn",
      message: "Voiceover audio is not generated yet; generate it before FFmpeg render work.",
    };
  }
  return {
    name: "voiceover audio available",
    status: "block",
    message: evidence.message,
  };
}
