export type ScriptProductionUnit = Readonly<{ label: "narration" | "visual"; text: string }>;

/**
 * Parses narration and visual units from the approved labeled script without including headings.
 */
export function parseScriptProductionUnits(script: string): ScriptProductionUnit[] {
  return cleanScriptProductionText(script)
    .split(/\n+/u)
    .flatMap((line) => parseProductionLine(line.trim()))
    .filter((unit) => unit.text.length > 0);
}

export function renderSpokenNarration(script: string): string {
  return parseScriptProductionUnits(script)
    .filter((unit) => unit.label === "narration")
    .map((unit) => unit.text)
    .join("\n\n");
}

export function countSpokenNarrationWords(script: string): number {
  return renderSpokenNarration(script).split(/\s+/u).filter(Boolean).length;
}

export function cleanScriptProductionText(script: string): string {
  return script
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .join("\n")
    .replaceAll(/\n{3,}/gu, "\n\n")
    .trim();
}

function parseProductionLine(line: string): ScriptProductionUnit[] {
  if (!line) {
    return [];
  }
  const labelPattern = /\b(Anlatıcı|Görsel):\s*/gu;
  const matches = [...line.matchAll(labelPattern)];
  if (matches.length === 0) {
    return [{ label: "narration", text: line }];
  }

  const units: ScriptProductionUnit[] = [];
  const prefix = line.slice(0, matches[0].index).trim();
  if (prefix) {
    units.push({ label: "narration", text: prefix });
  }
  for (const [index, match] of matches.entries()) {
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? line.length;
    const text = line.slice(start, end).trim();
    if (text) {
      units.push({ label: match[1] === "Görsel" ? "visual" : "narration", text });
    }
  }
  return units;
}
