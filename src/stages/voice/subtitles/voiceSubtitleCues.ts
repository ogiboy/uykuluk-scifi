import { SafeExitError } from "../../../core/errors.js";
import type { VoiceoverPreparationV2 } from "../voiceoverPreparation.js";
import { voiceSubtitleThresholds } from "./voiceSubtitleContracts.js";
import { codeUnitWidthAt, visibleLength, wrapTokens } from "./voiceSubtitleText.js";
import type { DisplayToken } from "./voiceSubtitleTypes.js";

export function buildCueCandidates(
  source: string,
  preparation: VoiceoverPreparationV2,
): DisplayToken[][] {
  const tokens = buildDisplayTokens(source.trimEnd(), preparation);
  const cues: DisplayToken[][] = [];
  let current: DisplayToken[] = [];
  for (const token of tokens) {
    const currentText = wrapTokens(current).join(" ");
    if (
      current.length > 0 &&
      visibleLength(currentText) >= voiceSubtitleThresholds.minCueTextLengthBeforeBreak &&
      /[.!?…]["')\]]?$/u.test(current.at(-1)?.text ?? "")
    ) {
      cues.push(current);
      current = [token];
      continue;
    }
    const candidate = [...current, token];
    if (wrapTokens(candidate).length <= voiceSubtitleThresholds.maxLinesPerCue) {
      current = candidate;
      continue;
    }
    if (current.length === 0) {
      throw new SafeExitError(
        "Voice subtitle token cannot fit within the 46-character line limit.",
      );
    }
    cues.push(current);
    current = [token];
  }
  if (current.length > 0) cues.push(current);
  if (cues.length === 0) throw new SafeExitError("Voice subtitle generation produced no cues.");
  return cues;
}

function buildDisplayTokens(source: string, preparation: VoiceoverPreparationV2): DisplayToken[] {
  const occurrences = preparation.replacementOccurrences;
  const tokens: DisplayToken[] = [];
  let cursor = 0;
  while (cursor < source.length) {
    if (/\s/u.test(source[cursor] ?? "")) {
      cursor += 1;
      continue;
    }
    const occurrence = occurrences.find((item) => item.sourceSpan.start === cursor);
    if (occurrence) {
      if (visibleLength(occurrence.source) > voiceSubtitleThresholds.maxCharactersPerLine) {
        throw new SafeExitError(
          "A pronunciation replacement source cannot fit within one subtitle line.",
        );
      }
      tokens.push({
        start: occurrence.sourceSpan.start,
        end: occurrence.sourceSpan.end,
        text: occurrence.source.replaceAll(/\s+/gu, " "),
        replacementSource: true,
      });
      cursor = occurrence.sourceSpan.end;
      continue;
    }
    let end = cursor;
    while (end < source.length && !/\s/u.test(source[end] ?? "")) {
      const startsOccurrence = occurrences.some((item) => item.sourceSpan.start === end);
      if (startsOccurrence && end > cursor) break;
      end += codeUnitWidthAt(source, end);
    }
    const token = source.slice(cursor, end);
    tokens.push(...splitLongToken({ start: cursor, end, text: token, replacementSource: false }));
    cursor = end;
  }
  return tokens;
}

function splitLongToken(token: DisplayToken): DisplayToken[] {
  if (visibleLength(token.text) <= voiceSubtitleThresholds.maxCharactersPerLine) return [token];
  const result: DisplayToken[] = [];
  let start = token.start;
  let text = "";
  let cursor = token.start;
  while (cursor < token.end) {
    const width = codeUnitWidthAt(token.text, cursor - token.start);
    const character = token.text.slice(cursor - token.start, cursor - token.start + width);
    if (visibleLength(text + character) > voiceSubtitleThresholds.maxCharactersPerLine) {
      result.push({ start, end: cursor, text, replacementSource: false });
      start = cursor;
      text = "";
    }
    text += character;
    cursor += width;
  }
  if (text) result.push({ start, end: token.end, text, replacementSource: false });
  return result;
}
