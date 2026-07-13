import type { VoicePreviewEvidence, VoiceSelection } from "./catalog/voiceAuditionContracts.js";
import type { VoiceCandidates } from "./catalog/voiceCatalogContracts.js";

export function formatVoiceCandidatesConsole(catalog: VoiceCandidates): string {
  const counts = catalog.candidates.reduce(
    (result, candidate) => {
      result[candidate.productionEligibility.status] += 1;
      return result;
    },
    { eligible: 0, "preview-only": 0, "review-required": 0, blocked: 0 },
  );
  return [
    "ElevenLabs voice candidates recorded.",
    `Candidates: ${catalog.candidates.length}`,
    `Turkish verified: ${catalog.candidates.filter((candidate) => candidate.verifiedLanguages.some((language) => language.language === "tr")).length}`,
    `Eligibility: eligible=${counts.eligible}, review=${counts["review-required"]}, preview-only=${counts["preview-only"]}, blocked=${counts.blocked}`,
    `Model: ${catalog.model.modelId}`,
    `Subscription: ${catalog.subscription.tier} (${catalog.subscription.productionUseStatus})`,
    "Artifact: latest registered production/audio/voice-candidates/*.json",
    "Next safe action: audition a persisted candidate preview before selecting a production voice.",
  ].join("\n");
}

export function formatVoicePreviewConsole(evidence: VoicePreviewEvidence): string {
  return [
    "ElevenLabs voice preview recorded for local audition.",
    `Voice: ${evidence.candidate.voiceId}`,
    `Format: ${evidence.output.format}`,
    `Bytes: ${evidence.output.bytes}`,
    `Audio SHA-256: ${evidence.output.sha256}`,
    `Evidence: ${voicePreviewEvidenceLabel(evidence.output.path, evidence.output.format)}`,
    `Audio: ${evidence.output.path}`,
    "Next safe action: listen locally, then record an attributable voice selection.",
  ].join("\n");
}

export function formatVoiceSelectionConsole(selection: VoiceSelection): string {
  return [
    "Voice selection recorded.",
    `Voice: ${selection.voice.name} (${selection.voice.voiceId})`,
    `Model: ${selection.model.modelId}`,
    `Eligibility: ${selection.voice.productionEligibility.status}`,
    `Selected by: ${selection.selectedBy}`,
    `Selection digest: ${selection.selectionDigest}`,
    "Artifact: latest registered production/audio/voice-selections/*.json",
    selection.voice.productionEligibility.status === "preview-only"
      ? "Production remains blocked: this account/voice is preview-only."
      : "Next safe action: create an exact selection-bound production cost quote.",
  ].join("\n");
}

function voicePreviewEvidenceLabel(audioPath: string, format: "mp3" | "wav"): string {
  return audioPath.replace(new RegExp(`\\.${format}$`, "u"), ".json");
}
