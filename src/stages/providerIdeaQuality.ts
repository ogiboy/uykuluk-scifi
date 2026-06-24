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

const ideaRatingValues = new Set(["low", "medium", "high"]);
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
  if (ideaRatingValues.has(idea.fit.trim().toLocaleLowerCase("en-US"))) {
    return {
      path: ["fit"],
      message: "Fit must be a Turkish explanation, not a rating.",
    };
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
    return {
      path: [],
      message: "Human-facing idea fields must be Turkish.",
    };
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

export function validateIdeaListQuality(ideas: NormalizedProviderIdea[]): string | undefined {
  const duplicateTitle = firstDuplicateField(ideas, "title");
  if (duplicateTitle) {
    return `ideas.${duplicateTitle.index}.title: Ideas must be meaningfully distinct.`;
  }
  const duplicatePremise = firstDuplicateField(ideas, "premise");
  if (duplicatePremise) {
    return `ideas.${duplicatePremise.index}.premise: Ideas must be meaningfully distinct.`;
  }
  const duplicateFit = firstDuplicateField(ideas, "fit");
  if (duplicateFit) {
    return `ideas.${duplicateFit.index}.fit: Fit explanations must be slot-specific and distinct.`;
  }
  const repeatedTitleMotif = repeatedTitleMotifIssue(ideas);
  if (repeatedTitleMotif) {
    return repeatedTitleMotif;
  }
  const repeatedPremiseFrame = repeatedPremiseFrameIssue(ideas);
  if (repeatedPremiseFrame) {
    return repeatedPremiseFrame;
  }
  return undefined;
}

function normalizeBrandText(value: string): string {
  return value.replaceAll(/\bUykulukSci(?:y?Fi)?\b/gu, "UykulukSciFi");
}

function brandSpellingIssue(
  idea: NormalizedProviderIdea,
): { path: string[]; message: string } | undefined {
  const field = brandCheckedFields.find((key) => hasMalformedBrandFragment(String(idea[key])));
  return field
    ? {
        path: [field],
        message: "UykulukSciFi brand spelling must be exact.",
      }
    : undefined;
}

function englishOperatorFieldIssue(
  idea: NormalizedProviderIdea,
): { path: string[]; message: string } | undefined {
  const field = humanFacingFields.find((key) => containsEnglishIdeaText(String(idea[key])));
  return field
    ? {
        path: [field],
        message: "Human-facing idea fields must not contain English operator text.",
      }
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

function hasMalformedBrandFragment(text: string): boolean {
  return /\bUykulukSci(?!Fi)\p{L}*/u.test(text) || /\bUykul(?!ukSciFi)\p{L}*/u.test(text);
}

function containsEnglishIdeaText(text: string): boolean {
  return containsEnglishOperatorMarkers(text) || /\b(?:exoplanet|terraforming)\p{L}*/iu.test(text);
}

function firstDuplicateField(
  ideas: NormalizedProviderIdea[],
  field: "fit" | "premise" | "title",
): { index: number } | undefined {
  const seen = new Set<string>();
  for (const [index, idea] of ideas.entries()) {
    const signature = ideaSignature(idea[field]);
    if (seen.has(signature)) {
      return { index };
    }
    seen.add(signature);
  }
  return undefined;
}

function repeatedTitleMotifIssue(ideas: NormalizedProviderIdea[]): string | undefined {
  const seen = new Map<string, number>();
  for (const [index, idea] of ideas.entries()) {
    for (const motif of genericTitleMotifs(idea.title)) {
      if (seen.has(motif)) {
        return `ideas.${index}.title: Repeated title motif "${motif}" weakens idea diversity.`;
      }
      seen.set(motif, index);
    }
  }
  return undefined;
}

function genericTitleMotifs(title: string): string[] {
  const words = ideaSignature(title).split(" ").filter(Boolean);
  return titleMotifs.filter((motif) => words.some((word) => word.startsWith(motif)));
}

function ideaSignature(value: string): string {
  return value
    .toLocaleLowerCase("tr")
    .replaceAll(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const titleMotifs = ["karanlık", "karanlik", "mesaj", "uyku", "yıldız", "yildiz", "gezegen"];

function repeatedPremiseFrameIssue(ideas: NormalizedProviderIdea[]): string | undefined {
  const phraseOwners = new Map<string, Set<number>>();
  for (const [index, idea] of ideas.entries()) {
    for (const phrase of premiseFramePhrases(idea.premise)) {
      const owners = phraseOwners.get(phrase) ?? new Set<number>();
      owners.add(index);
      phraseOwners.set(phrase, owners);
      if (owners.size >= 3) {
        return `ideas.${index}.premise: Ideas reuse a repeated premise frame.`;
      }
    }
  }
  return undefined;
}

function premiseFramePhrases(premise: string): Set<string> {
  const words = ideaSignature(premise).split(" ").filter(Boolean);
  const phrases = new Set<string>();
  for (let index = 0; index <= words.length - 5; index += 1) {
    const phraseWords = words.slice(index, index + 5);
    if (contentWordCount(phraseWords) >= 3) {
      phrases.add(phraseWords.join(" "));
    }
  }
  return phrases;
}

function contentWordCount(words: string[]): number {
  return words.filter((word) => !premiseFrameStopWords.has(word)).length;
}

const premiseFrameStopWords = new Set([
  "acaba",
  "ama",
  "belki",
  "bir",
  "bu",
  "da",
  "de",
  "diye",
  "gibi",
  "için",
  "ile",
  "mi",
  "mı",
  "mu",
  "mü",
  "ve",
  "veya",
  "ya",
]);
