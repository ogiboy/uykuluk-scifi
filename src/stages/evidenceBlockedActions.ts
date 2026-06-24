import type { ProducerConfig } from "../config/schema.js";
import type { DraftRenderEvidence } from "./renderEvidence.js";
import type { RenderPlanEvidence } from "./renderPlan.js";
import type { VoiceoverAudioEvidence } from "./voiceoverEvidence.js";

export function evidenceBlockedActions(
  config: ProducerConfig,
  renderPlan: RenderPlanEvidence,
  voiceoverAudio: VoiceoverAudioEvidence,
  draftRender: DraftRenderEvidence,
  unresolvedCostReservationCount: number,
): string[] {
  return [
    renderPlan.status === "missing"
      ? "Render plan not generated; run pnpm producer render-plan --run <run_id> before TTS/render work."
      : undefined,
    renderPlan.status === "block"
      ? `Render plan evidence is blocked: ${renderPlan.message}`
      : undefined,
    voiceoverAudio.status === "block"
      ? `Voiceover audio evidence is blocked: ${voiceoverAudio.message}`
      : undefined,
    draftRender.status === "block"
      ? `Draft render evidence is blocked: ${draftRender.message}`
      : undefined,
    !config.providers.tts.enabled ? "TTS disabled until configured and approved." : undefined,
    !config.providers.imageGeneration.enabled
      ? "Image/video generation disabled until configured and approved."
      : undefined,
    !config.providers.youtube.allowPrivateUpload
      ? "Private YouTube upload disabled by default."
      : undefined,
    !config.providers.youtube.allowPublicPublish
      ? "Public/scheduled publish disabled by default."
      : undefined,
    unresolvedCostReservationCount > 0
      ? `${unresolvedCostReservationCount} cost reservation outcome(s) remain active or uncertain; internal reconciliation is required.`
      : undefined,
  ].filter((item): item is string => Boolean(item));
}
