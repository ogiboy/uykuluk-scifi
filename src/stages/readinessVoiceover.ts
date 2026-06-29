import { loadConfig } from "../config/config.js";
import { RunRecord } from "../core/state.js";
import { readVoiceoverAudioEvidence } from "./voiceoverEvidence.js";
import type { ReadinessCheck } from "./readiness.js";

/**
 * Checks whether voiceover audio is available and suitable for rendering.
 *
 * @param run - The run record to inspect.
 * @returns A readiness check for voiceover audio availability.
 */
export async function voiceoverReadinessCheck(run: RunRecord): Promise<ReadinessCheck> {
  const evidence = await readVoiceoverAudioEvidence(run);
  if (evidence.status === "pass") {
    const referenceOnly =
      evidence.productionVoiceCandidate === false
        ? " This is timing/reference audio only; use reviewed local Piper audio before final production voice."
        : "";
    return {
      name: "voiceover audio available",
      status: evidence.productionVoiceCandidate ? "pass" : "warn",
      message: `${evidence.path} exists with ${Math.round(evidence.durationSeconds)}s ${evidence.mode} audio.${referenceOnly}`,
      nextAction: `pnpm producer review voice --run ${run.runId}`,
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
    nextAction: await voiceoverNextAction(run),
  };
}

/**
 * Builds the next safe operator action for blocked voiceover evidence.
 *
 * @param run - The run record used to populate the command.
 * @returns The local TTS remediation command or configuration instruction.
 */
async function voiceoverNextAction(run: RunRecord): Promise<string> {
  const config = await loadConfig();
  if (config.providers.tts.enabled) {
    return `pnpm producer voice --run ${run.runId}`;
  }
  return `Enable local TTS in producer.config.json, then pnpm producer voice --run ${run.runId}`;
}
