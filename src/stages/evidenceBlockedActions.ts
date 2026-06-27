import type { ProducerConfig } from "../config/schema.js";
import type { DraftRenderEvidence } from "./renderEvidence.js";
import type { RenderPlanEvidence } from "./renderPlan.js";
import type { VoiceoverAudioEvidence } from "./voiceoverEvidence.js";

/**
 * Builds the list of blocked-action messages for producer evidence and capability settings.
 *
 * @param config - Producer configuration used to check provider enablement.
 * @param renderPlan - Render plan evidence state.
 * @param voiceoverAudio - Voiceover audio evidence state.
 * @param draftRender - Draft render evidence state.
 * @param unresolvedCostReservationCount - Number of active or uncertain cost reservation outcomes.
 * @returns The blocked-action messages.
 */
export function evidenceBlockedActions(
  config: ProducerConfig,
  renderPlan: RenderPlanEvidence,
  voiceoverAudio: VoiceoverAudioEvidence,
  draftRender: DraftRenderEvidence,
  unresolvedCostReservationCount: number,
): string[] {
  const ttsDisabled = config.providers.tts.enabled === false;
  const imageGenerationDisabled = config.providers.imageGeneration.enabled === false;
  const privateUploadDisabled = config.providers.youtube.allowPrivateUpload === false;
  const publicPublishDisabled = config.providers.youtube.allowPublicPublish === false;
  const blockedActions: string[] = [];

  if (renderPlan.status === "missing") {
    blockedActions.push(
      "Render plan not generated; run pnpm producer render-plan --run <run_id> before TTS/render work.",
    );
  }
  if (renderPlan.status === "block") {
    blockedActions.push(`Render plan evidence is blocked: ${renderPlan.message}`);
  }
  if (voiceoverAudio.status === "block") {
    blockedActions.push(`Voiceover audio evidence is blocked: ${voiceoverAudio.message}`);
  }
  if (voiceoverAudio.status === "pass" && !voiceoverAudio.productionVoiceCandidate) {
    blockedActions.push(
      "Production voice candidate is not available; deterministic local audio is timing/reference only until reviewed local Piper audio exists.",
    );
  }
  if (draftRender.status === "block") {
    blockedActions.push(`Draft render evidence is blocked: ${draftRender.message}`);
  }
  if (ttsDisabled) {
    blockedActions.push("TTS disabled until configured and approved.");
  }
  if (imageGenerationDisabled) {
    blockedActions.push("Image/video generation disabled until configured and approved.");
  }
  if (privateUploadDisabled) {
    blockedActions.push("Private YouTube upload disabled by default.");
  }
  if (publicPublishDisabled) {
    blockedActions.push("Public/scheduled publish disabled by default.");
  }
  if (unresolvedCostReservationCount > 0) {
    blockedActions.push(
      `${unresolvedCostReservationCount} cost reservation outcome(s) remain active or uncertain; internal reconciliation is required.`,
    );
  }

  return blockedActions;
}
