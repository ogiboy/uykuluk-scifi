export type VoiceoverRenderApprovalScope = "production-voice-candidate" | "timing-draft-only";

const voiceoverAudioPath = "production/audio/voiceover.wav";

/**
 * Builds the render approval command for a voiceover review.
 *
 * @param runId - The run identifier to approve for local render.
 * @returns The copy-pasteable render approval command.
 */
export function voiceoverRenderApprovalCommand(runId: string): string {
  return `pnpm producer approve render --run ${runId}`;
}

/**
 * Builds the run-scoped local audio path operators should open before approving render.
 *
 * @param runId - The run identifier that owns the voiceover artifact.
 * @returns A copy-pasteable path from the project root to the generated WAV.
 */
export function voiceoverLocalPlaybackPath(runId: string): string {
  return `runs/${runId}/${voiceoverAudioPath}`;
}

/**
 * Classifies the render approval scope implied by reviewed voiceover evidence.
 *
 * @param productionVoiceCandidate - Whether the voiceover is a production-quality candidate.
 * @returns The explicit render approval scope operators should apply.
 */
export function voiceoverRenderApprovalScope(
  productionVoiceCandidate: boolean,
): VoiceoverRenderApprovalScope {
  return productionVoiceCandidate ? "production-voice-candidate" : "timing-draft-only";
}
