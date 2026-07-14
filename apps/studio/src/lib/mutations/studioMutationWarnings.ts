/** Normalizes bounded operator-visible warnings from unknown mutation responses. */
export function studioMutationWarnings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map(sanitizeStudioMutationWarning)
    .filter(Boolean)
    .slice(0, 3)
    .map((item) => item.slice(0, 500));
}

function sanitizeStudioMutationWarning(value: string): string {
  const withoutAnsi = stripAnsiSequences(value);
  let normalized = "";
  for (const character of withoutAnsi) {
    const code = character.codePointAt(0) ?? 0;
    const isControl = code <= 0x1f || (code >= 0x7f && code <= 0x9f);
    const isBidirectionalFormatting =
      code === 0x061c ||
      code === 0x200e ||
      code === 0x200f ||
      (code >= 0x202a && code <= 0x202e) ||
      (code >= 0x2066 && code <= 0x2069);
    normalized += isControl || isBidirectionalFormatting ? " " : character;
  }
  return normalized.replace(/\s+/gu, " ").trim();
}

function stripAnsiSequences(value: string): string {
  let normalized = "";
  let index = 0;
  while (index < value.length) {
    if (value.codePointAt(index) !== 0x1b) {
      normalized += value[index];
      index += 1;
      continue;
    }
    index = skipAnsiSequence(value, index);
  }
  return normalized;
}

function skipAnsiSequence(value: string, escapeIndex: number): number {
  const kind = value.codePointAt(escapeIndex + 1);
  if (kind === 0x5b) return skipCsiSequence(value, escapeIndex + 2);
  if (kind === 0x5d) return skipOscSequence(value, escapeIndex + 2);
  return escapeIndex + 1;
}

function skipCsiSequence(value: string, index: number): number {
  while (index < value.length) {
    const code = value.codePointAt(index) ?? 0;
    index += 1;
    if (code >= 0x40 && code <= 0x7e) break;
  }
  return index;
}

function skipOscSequence(value: string, index: number): number {
  while (index < value.length) {
    const code = value.codePointAt(index);
    if (code === 0x07) return index + 1;
    if (code === 0x1b && value.codePointAt(index + 1) === 0x5c) return index + 2;
    index += 1;
  }
  return index;
}
