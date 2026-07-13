import { SafeExitError } from "../../../core/errors.js";
import type { VoiceCandidates } from "./voiceCatalogContracts.js";
import { canonicalVoiceEvidenceDigest } from "./voiceCatalogDigest.js";

/**
 * Validates the digests, pricing snapshots, subscription status, and candidate identifiers in a voice catalog.
 *
 * @param catalog - The voice catalog to validate
 * @throws SafeExitError If any persisted digest, pricing value, subscription status, or candidate identifier is inconsistent.
 */
export function assertNestedCatalogDigests(catalog: VoiceCandidates): void {
  const { metadataDigest: modelDigest, ...modelInput } = catalog.model;
  if (canonicalVoiceEvidenceDigest(modelInput) !== modelDigest) {
    throw new SafeExitError("Voice catalog model digest does not match its persisted content.");
  }
  const { digest: subscriptionDigest, ...subscriptionInput } = catalog.subscription;
  if (canonicalVoiceEvidenceDigest(subscriptionInput) !== subscriptionDigest) {
    throw new SafeExitError(
      "Voice catalog subscription digest does not match its persisted content.",
    );
  }
  const expectedUseStatus =
    catalog.subscription.tier.trim().toLowerCase() === "free"
      ? "blocked-free-tier"
      : "operator-rights-required";
  if (catalog.subscription.productionUseStatus !== expectedUseStatus) {
    throw new SafeExitError("Voice catalog subscription production status is inconsistent.");
  }
  const expectedRate =
    catalog.pricing.baseUsdPerThousandCharacters *
    catalog.pricing.characterCostMultiplier *
    catalog.pricing.costDiscountMultiplier;
  if (Math.abs(expectedRate - catalog.pricing.effectiveUsdPerThousandCharacters) > 1e-12) {
    throw new SafeExitError("Voice catalog pricing snapshot is internally inconsistent.");
  }
  const expectedMaximumRate =
    catalog.pricing.baseUsdPerThousandCharacters *
    catalog.pricing.characterCostMultiplier *
    Math.max(1, catalog.pricing.costDiscountMultiplier);
  if (Math.abs(expectedMaximumRate - catalog.pricing.maximumUsdPerThousandCharacters) > 1e-12) {
    throw new SafeExitError("Voice catalog maximum pricing snapshot is internally inconsistent.");
  }
  const { digest: pricingDigest, ...pricingInput } = catalog.pricing;
  if (canonicalVoiceEvidenceDigest(pricingInput) !== pricingDigest) {
    throw new SafeExitError("Voice catalog pricing digest does not match its persisted content.");
  }
  const seenVoiceIds = new Set<string>();
  for (const candidate of catalog.candidates) {
    if (seenVoiceIds.has(candidate.voiceId)) {
      throw new SafeExitError("Voice candidate catalog contains a duplicate candidate id.");
    }
    seenVoiceIds.add(candidate.voiceId);
    const { metadataDigest, ...candidateInput } = candidate;
    if (canonicalVoiceEvidenceDigest(candidateInput) !== metadataDigest) {
      throw new SafeExitError(
        `Voice candidate metadata digest does not match persisted content: ${candidate.voiceId}.`,
      );
    }
  }
}
