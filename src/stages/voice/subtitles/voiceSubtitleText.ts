import { voiceSubtitleThresholds } from "./voiceSubtitleContracts.js";
import type { DisplayToken } from "./voiceSubtitleTypes.js";

export function wrapTokens(tokens: readonly DisplayToken[]): string[] {
  const lines: string[] = [];
  let current = "";
  for (const token of tokens) {
    const candidate = current ? `${current} ${token.text}` : token.text;
    if (visibleLength(candidate) <= voiceSubtitleThresholds.maxCharactersPerLine) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = token.text;
  }
  if (current) lines.push(current);
  return lines;
}

export function codeUnitWidthAt(value: string, index: number): number {
  const point = value.codePointAt(index);
  return point !== undefined && point > 0xffff ? 2 : 1;
}

export function visibleLength(value: string): number {
  return Array.from(value).length;
}

export function roundMillis(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}
