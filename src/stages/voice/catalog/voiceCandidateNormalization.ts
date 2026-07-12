import { sha256 } from "../../../utils/hash.js";
import type { VoiceCandidate } from "./voiceCatalogContracts.js";
import type { CatalogVoice, VoiceCatalogRequest } from "./voiceCatalogProvider.js";
import {
  boundedList,
  boundedOptional,
  boundedRequired,
  nonnegativeIntegerValue,
  nonnegativeNumber,
  normalizeLabels,
} from "./voiceCatalogValueNormalization.js";

export function normalizeVoiceCandidate(
  voice: CatalogVoice,
  request: VoiceCatalogRequest,
  subscriptionTier: string,
): VoiceCandidate | null {
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(voice.voiceId)) return null;
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
  const preferredPreview = preferredPreviewUrl(voice, request);
  const sourceClass = classifyPreview(preferredPreview.url);
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
    subscriptionTier,
    request,
  });
  const digestBase = { ...candidateBase, productionEligibility };
  return { ...digestBase, metadataDigest: sha256(JSON.stringify(digestBase)) };
}

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

function candidateEligibility(input: {
  candidate: Omit<VoiceCandidate, "metadataDigest" | "productionEligibility">;
  subscriptionTier: string;
  request: VoiceCatalogRequest;
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
    !input.candidate.availableForTiers.includes(input.subscriptionTier)
  ) {
    reasons.push("The current subscription tier is not listed for this voice.");
  }
  if (reasons.length > 0) return { status: "blocked", reasons };
  if (input.subscriptionTier.trim().toLowerCase() === "free") {
    return {
      status: "preview-only",
      reasons: ["Free-tier output is not eligible for this production publishing workflow."],
    };
  }
  if (
    !input.candidate.verifiedLanguages.some(
      (language) => language.language === input.request.languageCode,
    )
  ) {
    return {
      status: "review-required",
      reasons: ["Voice lacks Turkish-specific verification; pronunciation review is required."],
    };
  }
  return { status: "eligible", reasons: [] };
}

function preferredPreviewUrl(
  voice: CatalogVoice,
  request: VoiceCatalogRequest,
): { source: VoiceCandidate["preview"]["source"]; url?: string } {
  const verified = voice.verifiedLanguages ?? [];
  const exact = verified.find(
    (language) =>
      language.language === request.languageCode &&
      language.modelId === request.modelId &&
      language.previewUrl,
  );
  const languageMatch = verified.find(
    (language) => language.language === request.languageCode && language.previewUrl,
  );
  const url = exact?.previewUrl ?? languageMatch?.previewUrl;
  if (url) return { source: "verified-language", url };
  if (voice.previewUrl) return { source: "voice", url: voice.previewUrl };
  return { source: "none" };
}

function classifyPreview(value: string | undefined): VoiceCandidate["preview"]["sourceClass"] {
  if (!value) return "none";
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.hash ||
      (url.port && url.port !== "443")
    ) {
      return "unsupported";
    }
    if (url.hostname === "storage.googleapis.com") {
      return url.pathname.startsWith("/eleven-public-prod/") ? "eleven-public-prod" : "unsupported";
    }
    return url.hostname === "elevenlabs.io" || url.hostname.endsWith(".elevenlabs.io")
      ? "elevenlabs"
      : "unsupported";
  } catch {
    return "unsupported";
  }
}

export function candidateOrder(left: VoiceCandidate, right: VoiceCandidate): number {
  return candidateRank(left) - candidateRank(right) || left.name.localeCompare(right.name, "tr");
}

function candidateRank(candidate: VoiceCandidate): number {
  if (
    candidate.verifiedLanguages.some(
      (language) => language.language === "tr" && language.hasPreview,
    )
  ) {
    return 0;
  }
  if (candidate.verifiedLanguages.some((language) => language.language === "tr")) return 1;
  return candidate.preview.available ? 2 : 3;
}
