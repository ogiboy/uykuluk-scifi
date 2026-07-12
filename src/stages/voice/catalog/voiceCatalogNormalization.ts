import { SafeExitError } from "../../../core/errors.js";
import { sha256 } from "../../../utils/hash.js";
import { nowIso } from "../../../utils/time.js";
import { candidateOrder, normalizeVoiceCandidate } from "./voiceCandidateNormalization.js";
import {
  voiceCatalogProviderResultSchema,
  type VoiceCandidate,
  type VoiceCatalogProviderResult,
} from "./voiceCatalogContracts.js";
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

export function normalizeVoiceCatalog(input: NormalizeCatalogInput): VoiceCatalogProviderResult {
  const model = requireCompatibleModel(input.models, input.request);
  const subscription = normalizeSubscription(input.subscription);
  const { candidates, rejectedVoiceCount } = normalizeCandidates(
    input.voices,
    input.request,
    subscription.tier,
  );
  const characterCostMultiplier = requirePositiveRate(
    model.modelRates?.characterCostMultiplier,
    "character cost multiplier",
  );
  const costDiscountMultiplier = requirePositiveRate(
    model.modelRates?.costDiscountMultiplier ?? 1,
    "cost discount multiplier",
  );
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
    languages: Array.from(
      new Set(
        (model.languages ?? []).map((language) => language.languageId.trim()).filter(Boolean),
      ),
    ).sort(),
    ...(boundedOptional(model.concurrencyGroup, 120)
      ? { concurrencyGroup: boundedOptional(model.concurrencyGroup, 120) }
      : {}),
  };
  const modelSnapshot = {
    ...modelSnapshotBase,
    metadataDigest: sha256(JSON.stringify(modelSnapshotBase)),
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
    pricing: {
      source: "configured-base-plus-models-api",
      baseUsdPerThousandCharacters: input.request.usdPerThousandCharacters,
      characterCostMultiplier,
      costDiscountMultiplier,
      effectiveUsdPerThousandCharacters:
        input.request.usdPerThousandCharacters * characterCostMultiplier * costDiscountMultiplier,
      exactness: "standard-voice-only",
    },
    candidates: candidates.sort(candidateOrder).slice(0, input.request.maxCandidates),
  });
}

function normalizeCandidates(
  voices: CatalogVoice[],
  request: VoiceCatalogRequest,
  subscriptionTier: string,
): { candidates: VoiceCandidate[]; rejectedVoiceCount: number } {
  const candidates: VoiceCandidate[] = [];
  const seen = new Set<string>();
  let rejectedVoiceCount = 0;
  for (const voice of voices) {
    if (seen.has(voice.voiceId)) continue;
    seen.add(voice.voiceId);
    const candidate = normalizeVoiceCandidate(voice, request, subscriptionTier);
    if (candidate) candidates.push(candidate);
    else rejectedVoiceCount += 1;
  }
  return { candidates, rejectedVoiceCount };
}

function requireCompatibleModel(
  models: CatalogModel[],
  request: VoiceCatalogRequest,
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
  requirePositiveRate(model.modelRates?.characterCostMultiplier, "character cost multiplier");
  requirePositiveRate(model.modelRates?.costDiscountMultiplier ?? 1, "cost discount multiplier");
  return model;
}

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
  return { ...base, digest: sha256(JSON.stringify(base)) };
}
