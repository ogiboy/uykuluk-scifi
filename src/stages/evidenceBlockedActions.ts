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
  const ttsDisabled = config.providers.tts.enabled === false;
  const imageGenerationDisabled = config.providers.imageGeneration.enabled === false;
  const privateUploadDisabled = config.providers.youtube.allowPrivateUpload === false;
  const publicPublishDisabled = config.providers.youtube.allowPublicPublish === false;
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
    ttsDisabled ? "TTS disabled until configured and approved." : undefined,
    imageGenerationDisabled
      ? "Image/video generation disabled until configured and approved."
      : undefined,
    privateUploadDisabled ? "Private YouTube upload disabled by default." : undefined,
    publicPublishDisabled ? "Public/scheduled publish disabled by default." : undefined,
    unresolvedCostReservationCount > 0
      ? `${unresolvedCostReservationCount} cost reservation outcome(s) remain active or uncertain; internal reconciliation is required.`
      : undefined,
  ].filter((item): item is string => Boolean(item));
}
