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
    `Artifact: production/audio/voice_candidates.json`,
    "Next safe action: audition a persisted candidate preview before selecting a production voice.",
  ].join("\n");
}
