const ansiOscPattern = new RegExp("\\u001B\\][^\\u0007]*(?:\\u0007|\\u001B\\\\)", "gu");
const ansiCsiPattern = new RegExp("\\u001B\\[[0-?]*[ -/]*[@-~]", "gu");

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
  const withoutAnsi = value.replace(ansiOscPattern, "").replace(ansiCsiPattern, "");
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
