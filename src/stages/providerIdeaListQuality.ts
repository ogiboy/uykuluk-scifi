import { ideaSignature, type NormalizedProviderIdea } from "./providerIdeaQuality.js";

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
  return (
    repeatedFitFrameIssue(ideas) ??
    repeatedWeakFitMotifIssue(ideas) ??
    repeatedTitleMotifIssue(ideas) ??
    repeatedPremiseFrameIssue(ideas) ??
    repeatedUncertaintyOpenerIssue(ideas) ??
    repeatedWeakPremiseMotifIssue(ideas)
  );
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

function repeatedPremiseFrameIssue(ideas: NormalizedProviderIdea[]): string | undefined {
  const phraseOwners = new Map<string, Set<number>>();
  for (const [index, idea] of ideas.entries()) {
    for (const phrase of framePhrases(idea.premise, 5)) {
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

function repeatedFitFrameIssue(ideas: NormalizedProviderIdea[]): string | undefined {
  const phraseOwners = new Map<string, Set<number>>();
  for (const [index, idea] of ideas.entries()) {
    for (const phrase of framePhrases(idea.fit, 4)) {
      const owners = phraseOwners.get(phrase) ?? new Set<number>();
      owners.add(index);
      phraseOwners.set(phrase, owners);
      if (owners.size >= 3) {
        return `ideas.${index}.fit: Fit explanations reuse a repeated sentence frame.`;
      }
    }
  }
  return undefined;
}

function repeatedUncertaintyOpenerIssue(ideas: NormalizedProviderIdea[]): string | undefined {
  const openerOwners = new Map<string, Set<number>>();
  for (const [index, idea] of ideas.entries()) {
    for (const opener of uncertaintyOpeners(idea.premise)) {
      const owners = openerOwners.get(opener) ?? new Set<number>();
      owners.add(index);
      openerOwners.set(opener, owners);
      if (owners.size >= 3) {
        return `ideas.${index}.premise: Ideas overuse the same uncertainty opener "${opener}".`;
      }
    }
  }
  return undefined;
}

function uncertaintyOpeners(premise: string): string[] {
  const signature = ideaSignature(premise);
  return repeatedUncertaintyOpeners.filter((opener) => signature.includes(opener));
}

function repeatedWeakPremiseMotifIssue(ideas: NormalizedProviderIdea[]): string | undefined {
  const motifOwners = new Map<string, Set<number>>();
  for (const [index, idea] of ideas.entries()) {
    const text = ideaSignature(idea.premise);
    for (const motif of weakPremiseMotifs) {
      if (!motif.pattern.test(text)) {
        continue;
      }
      const owners = motifOwners.get(motif.label) ?? new Set<number>();
      owners.add(index);
      motifOwners.set(motif.label, owners);
      if (owners.size >= 3) {
        return `ideas.${index}.premise: Ideas reuse generic "${motif.label}" boilerplate instead of slot-specific uncertainty.`;
      }
    }
  }
  return undefined;
}

function repeatedWeakFitMotifIssue(ideas: NormalizedProviderIdea[]): string | undefined {
  const motifOwners = new Map<string, Set<number>>();
  for (const [index, idea] of ideas.entries()) {
    const text = ideaSignature(idea.fit);
    for (const motif of weakFitMotifs) {
      if (!motif.pattern.test(text)) {
        continue;
      }
      const owners = motifOwners.get(motif.label) ?? new Set<number>();
      owners.add(index);
      motifOwners.set(motif.label, owners);
      if (owners.size >= 3) {
        return `ideas.${index}.fit: Fit explanations reuse generic "${motif.label}" boilerplate instead of slot-specific channel value.`;
      }
    }
  }
  return undefined;
}

function framePhrases(value: string, size: number): Set<string> {
  const words = ideaSignature(value).split(" ").filter(Boolean);
  const phrases = new Set<string>();
  for (let index = 0; index <= words.length - size; index += 1) {
    const phraseWords = words.slice(index, index + size);
    if (contentWordCount(phraseWords) >= 3) {
      phrases.add(phraseWords.join(" "));
    }
  }
  return phrases;
}

function contentWordCount(words: string[]): number {
  return words.filter((word) => !premiseFrameStopWords.has(word)).length;
}

const titleMotifs = ["karanlık", "karanlik", "mesaj", "uyku", "yıldız", "yildiz", "gezegen"];
const repeatedUncertaintyOpeners = ["belki bu"];

const premiseFrameStopWords = new Set(
  "acaba ama belki bir bu da de diye gibi için ile mi mı mu mü ve veya ya".split(" "),
);

const weakPremiseMotifs: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  { label: "bilinmeyen bir tür", pattern: /\bbilinmeyen bir (?:yaşam )?tür\p{L}*/u },
  { label: "izlerini saklamak", pattern: /\bizler?ini sakla\p{L}*/u },
  { label: "varlığına dair ipucu", pattern: /\bvarlığ\p{L}* dair bir ipucu\b/u },
  { label: "bilgiyi bulduktan sonra", pattern: /\bbilgiyi bulduktan sonra\b/u },
  { label: "anlamaya çalışmak", pattern: /\banlamaya çalış\p{L}*/u },
];

const weakFitMotifs: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  { label: "bilimsel soruları", pattern: /\bbilimsel sorular\p{L}*/u },
  { label: "doğasıyla uyumludur", pattern: /\bdoğas\p{L}* uyumlu\p{L}*/u },
  { label: "etik dilemleri", pattern: /\betik dilemler\p{L}*/u },
  { label: "bilimsel sınırı aşan", pattern: /\bbilimsel sınırı aşan\b/u },
];
