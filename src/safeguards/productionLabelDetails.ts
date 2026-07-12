export type MalformedProductionLabelDetails = {
  labelFamily: "narration" | "visual";
  labelIssue:
    "markdown_formatted" | "misspelled_variant" | "unaccented_variant" | "unknown_related_label";
};

export type AmbiguousVisualDirectionDetails = { sentenceCount: string };

const allowedProductionLabels = new Set(["anlatıcı", "görsel"]);
const unaccentedProductionLabels = new Set(["anlatici", "gorsel"]);
const misspelledProductionLabels = new Set(["anlatı", "anlatyıcı"]);
const relatedNarrationLabels = new Set([
  "anlatı",
  "anlatıcı",
  "anlatici",
  "anlatım",
  "anlatim",
  "anlatyıcı",
]);

export function malformedProductionLabelDetails(
  script: string,
): MalformedProductionLabelDetails | undefined {
  const markdownFormatted = /`(Anlatıcı|Görsel):`/u.exec(script);
  if (markdownFormatted) {
    return {
      labelFamily: markdownFormatted[1] === "Anlatıcı" ? "narration" : "visual",
      labelIssue: "markdown_formatted",
    };
  }
  const labelPattern = /\b(\p{L}+)\s*[:-]/gu;
  let match: RegExpExecArray | null;
  while ((match = labelPattern.exec(script)) !== null) {
    const details = classifyProductionLabel(match[1] ?? "", match[0].endsWith(":") ? ":" : "-");
    if (details) {
      return details;
    }
  }
  return undefined;
}

export function ambiguousVisualDirectionDetails(
  script: string,
): AmbiguousVisualDirectionDetails | undefined {
  const labelPattern = /\b(Anlatıcı|Görsel):\s*/gu;
  const matches = [...script.matchAll(labelPattern)];
  for (const [index, match] of matches.entries()) {
    if (match[1] !== "Görsel") {
      continue;
    }
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? script.length;
    const sentenceCount = countCompleteSentences(script.slice(start, end));
    if (sentenceCount > 1) {
      return { sentenceCount: String(sentenceCount) };
    }
  }
  return undefined;
}

function countCompleteSentences(text: string): number {
  return [...text.matchAll(/[.!?…](?=\s|$)/gu)].length;
}

function classifyProductionLabel(
  label: string,
  separator: string,
): MalformedProductionLabelDetails | undefined {
  const normalized = label.toLocaleLowerCase("tr");
  if (separator === ":" && allowedProductionLabels.has(normalized)) {
    return undefined;
  }
  const labelFamily = labelFamilyFor(normalized);
  if (!labelFamily) {
    return undefined;
  }
  return { labelFamily, labelIssue: labelIssueFor(normalized) };
}

function labelFamilyFor(label: string): MalformedProductionLabelDetails["labelFamily"] | undefined {
  if (relatedNarrationLabels.has(label)) {
    return "narration";
  }
  if (
    label.startsWith("görsel") ||
    label.startsWith("gorsel") ||
    label.startsWith("görüntü") ||
    label.startsWith("goruntu")
  ) {
    return "visual";
  }
  return undefined;
}

function labelIssueFor(label: string): MalformedProductionLabelDetails["labelIssue"] {
  if (unaccentedProductionLabels.has(label)) {
    return "unaccented_variant";
  }
  if (misspelledProductionLabels.has(label)) {
    return "misspelled_variant";
  }
  return "unknown_related_label";
}
