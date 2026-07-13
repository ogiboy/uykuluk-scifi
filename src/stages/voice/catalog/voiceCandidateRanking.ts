import type { VoiceCandidate } from "./voiceCatalogContracts.js";
import type { CatalogVoice, VoiceCatalogRequest } from "./voiceCatalogProvider.js";

/**
 * Selects the most relevant preview URL for a language and model request.
 *
 * @param voice - The catalog voice containing candidate preview URLs.
 * @param request - The requested language and model identifiers.
 * @returns The selected preview source, classification, and URL when available.
 */
export function resolveVoicePreview(
  voice: CatalogVoice,
  request: Pick<VoiceCatalogRequest, "languageCode" | "modelId">,
): {
  source: VoiceCandidate["preview"]["source"];
  sourceClass: VoiceCandidate["preview"]["sourceClass"];
  url?: string;
} {
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
  if (url) return { source: "verified-language", sourceClass: classifyPreview(url), url };
  if (voice.previewUrl) {
    return {
      source: "voice",
      sourceClass: classifyPreview(voice.previewUrl),
      url: voice.previewUrl,
    };
  }
  return { source: "none", sourceClass: "none" };
}

/**
 * Classifies a preview URL by its supported provider and format.
 *
 * @param value - The preview URL to classify
 * @returns The preview source class, or `"none"` when no URL is provided
 */
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

/**
 * Orders voice candidates by request match quality and then by name.
 *
 * @param left - The first candidate to compare
 * @param right - The second candidate to compare
 * @param request - The requested language and model
 * @returns A negative number when `left` precedes `right`, a positive number when `right` precedes `left`, or zero when they are equivalent
 */
export function candidateOrder(
  left: VoiceCandidate,
  right: VoiceCandidate,
  request: Pick<VoiceCatalogRequest, "languageCode" | "modelId">,
): number {
  return (
    candidateRank(left, request) - candidateRank(right, request) ||
    left.name.localeCompare(right.name, "tr")
  );
}

/**
 * Assigns a priority rank based on the candidate's verified language match and preview availability.
 *
 * @param request - The requested language and model.
 * @returns `0` for a matching verified language with a preview, `1` for a matching verified language without a preview, `2` for another candidate with a preview, or `3` otherwise.
 */
function candidateRank(
  candidate: VoiceCandidate,
  request: Pick<VoiceCatalogRequest, "languageCode" | "modelId">,
): number {
  if (
    candidate.verifiedLanguages.some(
      (language) =>
        language.language === request.languageCode &&
        language.modelId === request.modelId &&
        language.hasPreview,
    )
  ) {
    return 0;
  }
  if (
    candidate.verifiedLanguages.some(
      (language) =>
        language.language === request.languageCode && language.modelId === request.modelId,
    )
  ) {
    return 1;
  }
  return candidate.preview.available ? 2 : 3;
}
