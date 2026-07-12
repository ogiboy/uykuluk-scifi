import { SafeExitError } from "../../core/errors.js";

/** Splits long narration without changing text, preferring paragraph and sentence boundaries. */
export function splitElevenLabsText(text: string, maxCharacters: number): string[] {
  if (!text) {
    throw new SafeExitError("ElevenLabs TTS requires non-empty text.");
  }
  if (!Number.isInteger(maxCharacters) || maxCharacters < 250 || maxCharacters > 5_000) {
    throw new SafeExitError("ElevenLabs TTS chunk size must be between 250 and 5000 characters.");
  }

  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const hardEnd = Math.min(start + maxCharacters, text.length);
    const end = hardEnd === text.length ? hardEnd : preferredBreak(text, start, hardEnd);
    if (end <= start) {
      throw new SafeExitError("ElevenLabs TTS could not create a non-empty text chunk.");
    }
    chunks.push(text.slice(start, end));
    start = end;
  }
  return chunks;
}

function preferredBreak(text: string, start: number, hardEnd: number): number {
  const window = text.slice(start, hardEnd);
  const minimumOffset = Math.floor(window.length * 0.6);
  const candidates = [
    lastBoundaryEnd(window, /\n\n/g),
    lastBoundaryEnd(window, /[.!?…][\s\n]+/g),
    lastBoundaryEnd(window, /\n/g),
    lastBoundaryEnd(window, /\s+/g),
  ];
  const offset = candidates.find((candidate) => candidate >= minimumOffset);
  return start + (offset ?? window.length);
}

function lastBoundaryEnd(value: string, pattern: RegExp): number {
  let end = -1;
  for (const match of value.matchAll(pattern)) {
    end = (match.index ?? 0) + match[0].length;
  }
  return end;
}
