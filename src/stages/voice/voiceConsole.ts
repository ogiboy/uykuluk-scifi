import type { VoiceoverAudioMeta } from "./voiceoverEvidence.js";
import { voiceoverAudioMetaPath, voiceoverAudioReviewPath } from "./voiceoverEvidence.js";
import { voiceoverLocalPlaybackPath } from "./voiceoverReviewCommands.js";

/**
 * Formats the operator-facing console handoff after local voiceover generation completes.
 *
 * @param meta - The generated voiceover metadata written by `producer voice`.
 * @returns A concise local-only review handoff for CLI operators.
 */
export function formatVoiceoverGeneratedConsole(meta: VoiceoverAudioMeta): string {
  return [
    `Voiceover generated: ${meta.output.path}`,
    `Local playback path: ${voiceoverLocalPlaybackPath(meta.runId)}`,
    `Review artifact: ${voiceoverAudioReviewPath}`,
    `Metadata: ${voiceoverAudioMetaPath}`,
    `Mode: ${meta.mode}`,
    `Quality: ${meta.quality}`,
    `Duration: ${Math.round(meta.output.durationSeconds)}s`,
    `Production voice candidate: ${String(meta.quality !== "deterministic-local-reference")}`,
    `Next safe action: pnpm producer review voice --run ${meta.runId}`,
  ].join("\n");
}
