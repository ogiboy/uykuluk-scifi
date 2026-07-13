import { SafeExitError } from "../../../core/errors.js";
import { sha256 } from "../../../utils/hash.js";
import { nowIso } from "../../../utils/time.js";
import { candidateOrder, normalizeVoiceCandidate } from "./voiceCandidateNormalization.js";
import {
  voiceCatalogProviderResultSchema,
  type VoiceCandidate,
  type VoiceCatalogProviderResult,
} from "./voiceCatalogContracts.js";
import { canonicalVoiceEvidenceDigest } from "./voiceCatalogDigest.js";
import type {
  CatalogModel,
  CatalogSubscription,
  CatalogVoice,
  VoiceCatalogRequest,
} from "./voiceCatalogProvider.js";
import {
  boundedOptional,
  boundedRequired,
  nonnegativeInteger,
  positiveInteger,
  requirePositiveInteger,
  requirePositiveRate,
} from "./voiceCatalogValueNormalization.js";

type NormalizeCatalogInput = {
  request: VoiceCatalogRequest;
  voices: CatalogVoice[];
  models: CatalogModel[];
  subscription: CatalogSubscription;
  requestIds: string[];
};

/**
 * Normalizes a voice catalog for the configured subscription, model, and request.
 *
 * @param input - The catalog data and request configuration to normalize.
 * @returns A validated provider result containing the normalized subscription, model, pricing, and voice candidates.
 */
export function normalizeVoiceCatalog(input: NormalizeCatalogInput): VoiceCatalogProviderResult {
  const subscription = normalizeSubscription(input.subscription);
  const model = requireCompatibleModel(input.models, input.request, subscription.tier);
  const { candidates, rejectedVoiceCount } = normalizeCandidates(
    input.voices,
    input.request,
    subscription,
  );
  const characterCostMultiplier = requirePositiveRate(
    model.modelRates?.characterCostMultiplier,
    "character cost multiplier",
  );
  const costDiscountMultiplier = requirePositiveRate(
    model.modelRates?.costDiscountMultiplier ?? 1,
    "cost discount multiplier",
  );
  const languages = Array.from(
    new Set((model.languages ?? []).map((language) => language.languageId.trim()).filter(Boolean)),
  );
  languages.sort((left, right) => left.localeCompare(right));
  const sortedCandidates = [...candidates];
  sortedCandidates.sort((left, right) => candidateOrder(left, right, input.request));
  const pricingBase = {
    source: "configured-base-plus-models-api" as const,
    baseUsdPerThousandCharacters: input.request.usdPerThousandCharacters,
    characterCostMultiplier,
    costDiscountMultiplier,
    effectiveUsdPerThousandCharacters:
      input.request.usdPerThousandCharacters * characterCostMultiplier * costDiscountMultiplier,
    maximumUsdPerThousandCharacters:
      input.request.usdPerThousandCharacters *
      characterCostMultiplier *
      Math.max(1, costDiscountMultiplier),
    exactness: "standard-voice-only" as const,
  };
  const modelSnapshotBase = {
    modelId: model.modelId,
    ...(boundedOptional(model.name, 120) ? { name: boundedOptional(model.name, 120) } : {}),
    canDoTextToSpeech: true as const,
    canUseStyle: model.canUseStyle ?? false,
    canUseSpeakerBoost: model.canUseSpeakerBoost ?? false,
    maximumTextLengthPerRequest: requirePositiveInteger(
      model.maximumTextLengthPerRequest,
      "maximum text length",
    ),
    ...(positiveInteger(model.maxCharactersRequestFreeUser)
      ? { maxCharactersRequestFreeUser: model.maxCharactersRequestFreeUser }
      : {}),
    ...(positiveInteger(model.maxCharactersRequestSubscribedUser)
      ? { maxCharactersRequestSubscribedUser: model.maxCharactersRequestSubscribedUser }
      : {}),
    languages,
    ...(boundedOptional(model.concurrencyGroup, 120)
      ? { concurrencyGroup: boundedOptional(model.concurrencyGroup, 120) }
      : {}),
  };
  const modelSnapshot = {
    ...modelSnapshotBase,
    metadataDigest: canonicalVoiceEvidenceDigest(modelSnapshotBase),
  };

  return voiceCatalogProviderResultSchema.parse({
    provider: "elevenlabs",
    fetchedAt: nowIso(),
    requestIdHashes: Array.from(
      new Set(input.requestIds.filter(Boolean).map((requestId) => sha256(requestId))),
    ).slice(0, 16),
    sourceVoiceCount: input.voices.length,
    rejectedVoiceCount,
    subscription,
    model: modelSnapshot,
    pricing: { ...pricingBase, digest: canonicalVoiceEvidenceDigest(pricingBase) },
    candidates: sortedCandidates.slice(0, input.request.maxCandidates),
  });
}

/**
 * Normalizes catalog voices into candidates while tracking rejected entries.
 *
 * Duplicate voice IDs with conflicting metadata cause a `SafeExitError`.
 *
 * @param voices - The catalog voices to normalize
 * @param request - The request configuration used to normalize candidates
 * @param subscription - The subscription details used to evaluate voices
 * @returns The normalized candidates and count of rejected voices
 */
function normalizeCandidates(
  voices: CatalogVoice[],
  request: VoiceCatalogRequest,
  subscription: { tier: string; status: string; hasOpenInvoices: boolean },
): { candidates: VoiceCandidate[]; rejectedVoiceCount: number } {
  const candidates: VoiceCandidate[] = [];
  const seen = new Map<string, string>();
  let rejectedVoiceCount = 0;
  for (const voice of voices) {
    const rawDigest = canonicalVoiceEvidenceDigest(voice);
    const previousDigest = seen.get(voice.voiceId);
    if (previousDigest) {
      if (previousDigest !== rawDigest) {
        throw new SafeExitError(
          "ElevenLabs returned conflicting metadata for a duplicate voice id.",
        );
      }
      continue;
    }
    seen.set(voice.voiceId, rawDigest);
    const candidate = normalizeVoiceCandidate(voice, request, subscription);
    if (candidate) candidates.push(candidate);
    else rejectedVoiceCount += 1;
  }
  return { candidates, rejectedVoiceCount };
}

/**
 * Validates that the configured model supports the request and subscription constraints.
 *
 * @param models - Available catalog models
 * @param request - Voice synthesis request configuration
 * @param subscriptionTier - Current subscription tier used to select request limits
 * @returns The compatible catalog model
 */
function requireCompatibleModel(
  models: CatalogModel[],
  request: VoiceCatalogRequest,
  subscriptionTier: string,
): CatalogModel {
  const model = models.find((candidate) => candidate.modelId === request.modelId);
  if (!model) {
    throw new SafeExitError("ElevenLabs voice catalog did not return the configured model.");
  }
  if (model.canDoTextToSpeech !== true) {
    throw new SafeExitError("Configured ElevenLabs model is not enabled for text-to-speech.");
  }
  const languages = new Set((model.languages ?? []).map((language) => language.languageId));
  if (!languages.has(request.languageCode)) {
    throw new SafeExitError("Configured ElevenLabs model does not report Turkish support.");
  }
  const providerLimit = requirePositiveInteger(
    model.maximumTextLengthPerRequest,
    "maximum text length",
  );
  const configuredLimit = requirePositiveInteger(
    request.maxCharactersPerRequest,
    "configured request length",
  );
  if (configuredLimit > providerLimit) {
    throw new SafeExitError(
      "Configured ElevenLabs request length exceeds the current model limit.",
    );
  }
  const tierLimit =
    subscriptionTier.trim().toLowerCase() === "free"
      ? model.maxCharactersRequestFreeUser
      : model.maxCharactersRequestSubscribedUser;
  if (tierLimit !== undefined) {
    const safeTierLimit = requirePositiveInteger(tierLimit, "subscription request length");
    if (configuredLimit > safeTierLimit) {
      throw new SafeExitError(
        "Configured ElevenLabs request length exceeds the current subscription limit.",
      );
    }
  }
  requirePositiveRate(model.modelRates?.characterCostMultiplier, "character cost multiplier");
  requirePositiveRate(model.modelRates?.costDiscountMultiplier ?? 1, "cost discount multiplier");
  return model;
}

/**
 * Normalizes subscription details and assigns production-use status and an evidence digest.
 *
 * @param subscription - The subscription details to normalize.
 * @returns The normalized subscription with a canonical evidence digest.
 */
function normalizeSubscription(subscription: CatalogSubscription) {
  const base = {
    tier: boundedRequired(subscription.tier, 80, "subscription tier"),
    status: boundedRequired(subscription.status, 80, "subscription status"),
    characterCount: nonnegativeInteger(subscription.characterCount, "subscription usage"),
    characterLimit: nonnegativeInteger(subscription.characterLimit, "subscription limit"),
    ...(boundedOptional(subscription.currency, 16)
      ? { currency: boundedOptional(subscription.currency, 16) }
      : {}),
    hasOpenInvoices: subscription.hasOpenInvoices,
    productionUseStatus:
      subscription.tier.trim().toLowerCase() === "free"
        ? ("blocked-free-tier" as const)
        : ("operator-rights-required" as const),
  };
  return { ...base, digest: canonicalVoiceEvidenceDigest(base) };
}
