import { SafeExitError } from "../../../core/errors.js";
import type { TtsCharacterAlignment } from "../providers/ttsProvider.js";
import type { VoiceoverPreparationV2 } from "../voiceoverPreparation.js";
import type { AlignmentOffset } from "./voiceSubtitleTypes.js";

export function validateSubtitleAlignment(
  alignment: TtsCharacterAlignment,
  preparedText: string,
  audioDurationSeconds: number,
): TtsCharacterAlignment {
  const lengths = [
    alignment.characters.length,
    alignment.characterStartTimesSeconds.length,
    alignment.characterEndTimesSeconds.length,
  ];
  if (new Set(lengths).size !== 1 || lengths[0] === 0) {
    throw new SafeExitError("Voice subtitle alignment arrays must be non-empty and equal length.");
  }
  if (alignment.characters.join("") !== preparedText) {
    throw new SafeExitError(
      "ElevenLabs original alignment characters do not exactly match prepared synthesis text.",
    );
  }
  let previousEnd = 0;
  for (let index = 0; index < alignment.characters.length; index += 1) {
    const start = alignment.characterStartTimesSeconds[index] ?? -1;
    const end = alignment.characterEndTimesSeconds[index] ?? -1;
    if (start < previousEnd || end < start || end > audioDurationSeconds + 0.001) {
      throw new SafeExitError(
        "Voice subtitle alignment must be monotonic and within the audio duration.",
      );
    }
    previousEnd = end;
  }
  return alignment;
}

export function mapSourceBoundary(
  boundary: number,
  edge: "start" | "end",
  preparation: VoiceoverPreparationV2,
): number {
  let delta = 0;
  for (const occurrence of preparation.replacementOccurrences) {
    if (boundary < occurrence.sourceSpan.start) return boundary + delta;
    if (boundary === occurrence.sourceSpan.start) return occurrence.preparedSpan.start;
    if (boundary <= occurrence.sourceSpan.end) {
      if (boundary === occurrence.sourceSpan.end) return occurrence.preparedSpan.end;
      const sourceLength = occurrence.sourceSpan.end - occurrence.sourceSpan.start;
      const preparedLength = occurrence.preparedSpan.end - occurrence.preparedSpan.start;
      const ratio = (boundary - occurrence.sourceSpan.start) / sourceLength;
      const offset = ratio * preparedLength;
      return (
        occurrence.preparedSpan.start + (edge === "start" ? Math.floor(offset) : Math.ceil(offset))
      );
    }
    delta = occurrence.preparedSpan.end - occurrence.sourceSpan.end;
  }
  return boundary + delta;
}

export function alignmentCharacterOffsets(characters: readonly string[]): AlignmentOffset[] {
  let cursor = 0;
  return characters.map((character) => {
    const range = { start: cursor, end: cursor + character.length };
    cursor = range.end;
    return range;
  });
}

export function alignmentIndexRange(
  offsets: readonly AlignmentOffset[],
  preparedStart: number,
  preparedEnd: number,
): { start: number; end: number } {
  const start = offsets.findIndex((range) => range.end > preparedStart);
  let end = -1;
  for (let index = offsets.length - 1; index >= 0; index -= 1) {
    if ((offsets[index]?.start ?? Number.POSITIVE_INFINITY) < preparedEnd) {
      end = index;
      break;
    }
  }
  if (start < 0 || end < start) {
    throw new SafeExitError("Voice subtitle alignment span is missing.");
  }
  return { start, end };
}
