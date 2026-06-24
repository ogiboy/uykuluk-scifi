import { sha256 } from "../utils/hash.js";

export type RepeatedSentenceLoopDetails = {
  repeatCount: string;
  sentenceFingerprint: string;
};

const repeatedSentenceThreshold = 3;

export function repeatedSentenceLoopDetails(
  script: string,
): RepeatedSentenceLoopDetails | undefined {
  const sentenceCounts = new Map<string, number>();
  for (const sentence of normalizedSentences(script)) {
    const count = (sentenceCounts.get(sentence) ?? 0) + 1;
    if (count >= repeatedSentenceThreshold) {
      return {
        repeatCount: String(count),
        sentenceFingerprint: sha256(sentence).slice(0, 16),
      };
    }
    sentenceCounts.set(sentence, count);
  }
  return undefined;
}

function normalizedSentences(script: string): string[] {
  return script
    .split(/[.!?…]+/)
    .map((sentence) =>
      stripMarkdownHeadingPrefix(sentence)
        .replaceAll(/\b(?:Anlatıcı|Anlatici|Görsel|Gorsel)\s*:\s*/giu, "")
        .toLocaleLowerCase("tr")
        .replaceAll(/[^\p{L}\p{N}\s]+/gu, "")
        .replaceAll(/\s+/g, " ")
        .trim(),
    )
    .filter((sentence) => sentence.length >= 40);
}

function stripMarkdownHeadingPrefix(sentence: string): string {
  const trimmed = sentence.trimStart();
  let index = 0;
  while (trimmed[index] === "#") {
    index += 1;
  }
  return index > 0 && trimmed[index] === " " ? trimmed.slice(index + 1) : sentence;
}
