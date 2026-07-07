import {
  containsEnglishOperatorMarkers,
  looksLikeTurkishOperatorText,
} from "./providerLanguageQuality.js";
import type { VideoIdeaLevel } from "./types.js";

export type NormalizedProviderIdea = {
  title: string;
  premise: string;
  targetDuration: string;
  style: string;
  estimatedDifficulty: VideoIdeaLevel;
  riskLevel: VideoIdeaLevel;
  fit: string;
};

const ideaRatingValues = new Set([
  "düşük",
  "dusuk",
  "high",
  "low",
  "medium",
  "orta",
  "yüksek",
  "yuksek",
]);
const brandCheckedFields = ["title", "premise", "style", "fit"] as const;
const humanFacingFields = ["title", "premise", "targetDuration", "style", "fit"] as const;

export function validateIdeaQuality(
  idea: NormalizedProviderIdea,
): { path: string[]; message: string } | undefined {
  const englishFieldIssue = englishOperatorFieldIssue(idea);
  if (englishFieldIssue) {
    return englishFieldIssue;
  }
  const repeatedSentenceIssue = repeatedIdeaSentenceIssue(idea);
  if (repeatedSentenceIssue) {
    return repeatedSentenceIssue;
  }
  if (ideaRatingValues.has(idea.fit.trim().toLocaleLowerCase("tr"))) {
    return { path: ["fit"], message: "Fit must be a Turkish explanation, not a rating." };
  }
  if (!idea.targetDuration.toLocaleLowerCase("tr").includes("dakika")) {
    return {
      path: ["targetDuration"],
      message: "Target duration must use Turkish dakika wording.",
    };
  }
  const brandIssue = brandSpellingIssue(idea);
  if (brandIssue) {
    return brandIssue;
  }
  const humanText = [idea.title, idea.premise, idea.targetDuration, idea.style, idea.fit].join(" ");
  if (!looksLikeTurkishOperatorText(humanText)) {
    return { path: [], message: "Human-facing idea fields must be Turkish." };
  }
  return undefined;
}

export function normalizeIdeaBrandSpelling(idea: NormalizedProviderIdea): NormalizedProviderIdea {
  return {
    ...idea,
    fit: normalizeBrandText(idea.fit),
    premise: normalizeBrandText(idea.premise),
    style: normalizeBrandText(idea.style),
    title: normalizeBrandText(idea.title),
  };
}

function normalizeBrandText(value: string): string {
  return value.replaceAll(/\bUykulukSci(?:y?Fi)?\b/gu, "UykulukSciFi");
}

function brandSpellingIssue(
  idea: NormalizedProviderIdea,
): { path: string[]; message: string } | undefined {
  const field = brandCheckedFields.find((key) => hasMalformedBrandFragment(String(idea[key])));
  return field
    ? { path: [field], message: "UykulukSciFi brand spelling must be exact." }
    : undefined;
}

function englishOperatorFieldIssue(
  idea: NormalizedProviderIdea,
): { path: string[]; message: string } | undefined {
  const field = humanFacingFields.find((key) => containsEnglishIdeaText(String(idea[key])));
  return field
    ? { path: [field], message: "Human-facing idea fields must not contain English operator text." }
    : undefined;
}

function repeatedIdeaSentenceIssue(
  idea: NormalizedProviderIdea,
): { path: string[]; message: string } | undefined {
  for (const field of ["premise", "fit"] as const) {
    if (hasRepeatedSentence(idea[field])) {
      return {
        path: [field],
        message: "Idea repeats the same sentence; regenerate a cleaner local-model response.",
      };
    }
  }
  return undefined;
}

function hasRepeatedSentence(text: string): boolean {
  const seen = new Set<string>();
  for (const sentence of normalizedSentences(text)) {
    if (seen.has(sentence)) {
      return true;
    }
    seen.add(sentence);
  }
  return false;
}

function normalizedSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+/u)
    .map((sentence) => ideaSignature(sentence))
    .filter((sentence) => sentence.length >= 20);
}

export function ideaSignature(value: string): string {
  return value
    .toLocaleLowerCase("tr")
    .replaceAll(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function hasMalformedBrandFragment(text: string): boolean {
  return /\bUykulukSci(?!Fi)\p{L}*/u.test(text) || /\bUykul(?!ukSciFi)\p{L}*/u.test(text);
}

function containsEnglishIdeaText(text: string): boolean {
  return (
    containsEnglishOperatorMarkers(text) ||
    /\b(?:anomaly|exoplanet|terraforming)\p{L}*/iu.test(text)
  );
}
