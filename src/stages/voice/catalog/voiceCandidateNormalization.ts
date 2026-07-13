import { sha256 } from "../../../utils/hash.js";
import { resolveVoicePreview } from "./voiceCandidateRanking.js";
import type { VoiceCandidate } from "./voiceCatalogContracts.js";
import { canonicalVoiceEvidenceDigest } from "./voiceCatalogDigest.js";
import type { CatalogVoice, VoiceCatalogRequest } from "./voiceCatalogProvider.js";
import {
  boundedList,
  boundedOptional,
  boundedRequired,
  hasUnsafeControlCharacters,
  nonnegativeIntegerValue,
  nonnegativeNumber,
  normalizeLabels,
} from "./voiceCatalogValueNormalization.js";

export { candidateOrder, resolveVoicePreview } from "./voiceCandidateRanking.js";

/**
 * Normalizes a catalog voice into a validated candidate for the requested language and model.
 *
 * @param voice - The catalog voice to normalize
 * @param request - The requested language and model
 * @param subscription - The subscriber's tier, status, and invoice state
 * @returns A normalized voice candidate, or `null` when the voice fails validation
 */
export function normalizeVoiceCandidate(
  voice: CatalogVoice,
  request: Pick<VoiceCatalogRequest, "languageCode" | "modelId">,
  subscription: { tier: string; status: string; hasOpenInvoices: boolean },
): VoiceCandidate | null {
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(voice.voiceId)) return null;
  if (
    [
      voice.name,
      voice.category,
      voice.description,
      ...Object.entries(voice.labels ?? {}).flat(),
    ].some(hasUnsafeControlCharacters)
  ) {
    return null;
  }
  const verifiedLanguages = (voice.verifiedLanguages ?? [])
    .slice(0, 32)
    .map((language) => ({
      language: boundedRequired(language.language, 16, "verified language"),
      modelId: boundedRequired(language.modelId, 128, "verified language model"),
      ...(boundedOptional(language.accent, 80)
        ? { accent: boundedOptional(language.accent, 80) }
        : {}),
      ...(boundedOptional(language.locale, 32)
        ? { locale: boundedOptional(language.locale, 32) }
        : {}),
      hasPreview: Boolean(language.previewUrl),
    }))
    .sort((left, right) =>
      [left.language, left.modelId, left.locale ?? "", left.accent ?? ""]
        .join("\0")
        .localeCompare(
          [right.language, right.modelId, right.locale ?? "", right.accent ?? ""].join("\0"),
        ),
    );
  const preferredPreview = resolveVoicePreview(voice, request);
  const sourceClass = preferredPreview.sourceClass;
  const candidateBase = {
    voiceId: voice.voiceId,
    name: boundedOptional(voice.name, 120) ?? "Unnamed voice",
    category: boundedOptional(voice.category, 64) ?? "unknown",
    ...(boundedOptional(voice.description, 500)
      ? { description: boundedOptional(voice.description, 500) }
      : {}),
    labels: normalizeLabels(voice.labels),
    availableForTiers: boundedList(voice.availableForTiers, 16, 64),
    verifiedLanguages,
    highQualityBaseModelIds: boundedList(voice.highQualityBaseModelIds, 32, 128).filter((value) =>
      /^[A-Za-z0-9._-]+$/.test(value),
    ),
    isOwner: voice.isOwner ?? false,
    isLegacy: voice.isLegacy ?? false,
    isMixed: voice.isMixed ?? false,
    ...(boundedOptional(voice.recordingQuality, 64)
      ? { recordingQuality: boundedOptional(voice.recordingQuality, 64) }
      : {}),
    ...(voice.sharing ? { sharing: normalizeSharing(voice.sharing) } : {}),
    preview: {
      available: sourceClass !== "unsupported" && Boolean(preferredPreview.url),
      source: preferredPreview.source,
      sourceClass,
      ...(preferredPreview.url ? { urlSha256: sha256(preferredPreview.url) } : {}),
    },
  };
  const productionEligibility = candidateEligibility({
    candidate: candidateBase,
    subscription,
    request,
  });
  const digestBase = { ...candidateBase, productionEligibility };
  return { ...digestBase, metadataDigest: canonicalVoiceEvidenceDigest(digestBase) };
}

/**
 * Normalizes sharing settings for inclusion in a voice candidate.
 *
 * @param sharing - The source sharing settings.
 * @returns A normalized sharing settings object with bounded and validated values.
 */
function normalizeSharing(sharing: NonNullable<CatalogVoice["sharing"]>) {
  return {
    ...(boundedOptional(sharing.status, 64) ? { status: boundedOptional(sharing.status, 64) } : {}),
    ...(sharing.freeUsersAllowed === undefined
      ? {}
      : { freeUsersAllowed: sharing.freeUsersAllowed }),
    liveModerationEnabled: sharing.liveModerationEnabled ?? false,
    customRate: sharing.rate !== undefined || sharing.fiatRate !== undefined,
    ...(nonnegativeNumber(sharing.noticePeriod) ? { noticePeriodDays: sharing.noticePeriod } : {}),
    ...(nonnegativeIntegerValue(sharing.disableAtUnix)
      ? { disableAtUnix: sharing.disableAtUnix }
      : {}),
    ...(sharing.enabledInLibrary === undefined
      ? {}
      : { enabledInLibrary: sharing.enabledInLibrary }),
  };
}

/**
 * Determines whether a voice is eligible for production use under the current subscription and request.
 *
 * @param input - The candidate, subscription state, and requested language and model.
 * @returns The eligibility status and reasons, including blocking conditions, preview-only access, or required review.
 */
function candidateEligibility(input: {
  candidate: Omit<VoiceCandidate, "metadataDigest" | "productionEligibility">;
  subscription: { tier: string; status: string; hasOpenInvoices: boolean };
  request: Pick<VoiceCatalogRequest, "languageCode" | "modelId">;
}): VoiceCandidate["productionEligibility"] {
  const reasons: string[] = [];
  if (!input.candidate.preview.available) {
    reasons.push("No bounded provider preview is available for audition.");
  }
  if (input.candidate.sharing?.customRate) {
    reasons.push("Custom-rate shared voices are unsupported because exact pricing is unknown.");
  }
  if (input.candidate.sharing?.liveModerationEnabled) {
    reasons.push("Live-moderated shared voices are unsupported in the V1 production path.");
  }
  if (
    input.candidate.sharing?.disableAtUnix !== undefined &&
    input.candidate.sharing.disableAtUnix <= Math.floor(Date.now() / 1_000)
  ) {
    reasons.push("The provider reports that this voice is disabled.");
  }
  if (
    input.candidate.availableForTiers.length > 0 &&
    !input.candidate.availableForTiers.includes(input.subscription.tier)
  ) {
    reasons.push("The current subscription tier is not listed for this voice.");
  }
  if (input.subscription.hasOpenInvoices) {
    reasons.push("The provider reports open invoices on the current subscription.");
  }
  if (!isUsableSubscriptionStatus(input.subscription.status)) {
    reasons.push("The provider reports an inactive or unsupported subscription status.");
  }
  if (reasons.length > 0) return { status: "blocked", reasons };
  if (input.subscription.tier.trim().toLowerCase() === "free") {
    return {
      status: "preview-only",
      reasons: ["Free-tier output is not eligible for this production publishing workflow."],
    };
  }
  if (
    !input.candidate.verifiedLanguages.some(
      (language) =>
        language.language === input.request.languageCode &&
        language.modelId === input.request.modelId,
    )
  ) {
    return {
      status: "review-required",
      reasons: ["Voice lacks Turkish-specific verification; pronunciation review is required."],
    };
  }
  return {
    status: "review-required",
    reasons: [
      "Operator confirmation of production usage rights is required before paid synthesis.",
    ],
  };
}

/**
 * Determines whether a subscription status is supported for use.
 *
 * @param value - The subscription status to evaluate
 * @returns `true` if the status is active, trialing, or free, `false` otherwise
 */
function isUsableSubscriptionStatus(value: string): boolean {
  return ["active", "trialing", "free"].includes(value.trim().toLowerCase());
}
