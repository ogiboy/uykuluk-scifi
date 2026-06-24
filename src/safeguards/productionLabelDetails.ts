export type MalformedProductionLabelDetails = {
  labelFamily: "narration" | "visual";
  labelIssue: "misspelled_variant" | "unaccented_variant" | "unknown_related_label";
};

const allowedProductionLabels = new Set(["anlatıcı", "görsel"]);
const unaccentedProductionLabels = new Set(["anlatici", "gorsel"]);
const misspelledProductionLabels = new Set(["anlatı", "anlatyıcı"]);

export function malformedProductionLabelDetails(
  script: string,
): MalformedProductionLabelDetails | undefined {
  const labelPattern = /\b(\p{L}+)\s*:/gu;
  let match: RegExpExecArray | null;
  while ((match = labelPattern.exec(script)) !== null) {
    const details = classifyProductionLabel(match[1] ?? "");
    if (details) {
      return details;
    }
  }
  return undefined;
}

function classifyProductionLabel(label: string): MalformedProductionLabelDetails | undefined {
  const normalized = label.toLocaleLowerCase("tr");
  if (allowedProductionLabels.has(normalized)) {
    return undefined;
  }
  const labelFamily = labelFamilyFor(normalized);
  if (!labelFamily) {
    return undefined;
  }
  return {
    labelFamily,
    labelIssue: labelIssueFor(normalized),
  };
}

function labelFamilyFor(label: string): MalformedProductionLabelDetails["labelFamily"] | undefined {
  if (label.startsWith("anlat")) {
    return "narration";
  }
  if (label.startsWith("gör") || label.startsWith("gor")) {
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
