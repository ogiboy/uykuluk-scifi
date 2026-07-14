import { SafeExitError } from "../../../core/errors.js";
import type { TtsCharacterAlignment } from "../providers/ttsProvider.js";
import type { VoiceoverPreparationV2 } from "../voiceoverPreparation.js";
import {
  alignmentCharacterOffsets,
  alignmentIndexRange,
  mapSourceBoundary,
} from "./voiceSubtitleAlignment.js";
import { voiceSubtitleThresholds } from "./voiceSubtitleContracts.js";
import { roundMillis, visibleLength, wrapTokens } from "./voiceSubtitleText.js";
import type { AlignmentOffset, DisplayToken, SubtitleCue } from "./voiceSubtitleTypes.js";

export function timeCueCandidates(
  candidates: readonly DisplayToken[][],
  source: string,
  preparedText: string,
  preparation: VoiceoverPreparationV2,
  alignment: TtsCharacterAlignment,
  audioDurationSeconds: number,
): SubtitleCue[] {
  const alignmentOffsets = alignmentCharacterOffsets(alignment.characters);
  const durationBoundedCandidates = candidates.flatMap((tokens) =>
    splitCandidateForMaximumDuration(tokens, preparation, alignment, alignmentOffsets),
  );
  const raw = durationBoundedCandidates.map((tokens, index) => {
    const first = tokens[0];
    const last = tokens.at(-1);
    if (!first || !last) throw new SafeExitError("Voice subtitle cue is empty.");
    const preparedStart = mapSourceBoundary(first.start, "start", preparation);
    const preparedEnd = mapSourceBoundary(last.end, "end", preparation);
    const alignmentRange = alignmentIndexRange(alignmentOffsets, preparedStart, preparedEnd);
    const startSeconds = alignment.characterStartTimesSeconds[alignmentRange.start] ?? -1;
    const endSeconds = alignment.characterEndTimesSeconds[alignmentRange.end] ?? -1;
    const lines = wrapTokens(tokens);
    if (
      source.slice(first.start, last.end).trim().length === 0 ||
      preparedText.slice(preparedStart, preparedEnd).length === 0
    ) {
      throw new SafeExitError("Voice subtitle cue does not map to spoken text.");
    }
    return { index: index + 1, startSeconds, endSeconds, lines };
  });

  const cues: SubtitleCue[] = [];
  let previousEnd = 0;
  for (const [index, cue] of raw.entries()) {
    const nextStart = raw[index + 1]?.startSeconds ?? audioDurationSeconds;
    let start = Math.max(cue.startSeconds, previousEnd);
    let end = cue.endSeconds;
    const characterCount = visibleLength(cue.lines.join(""));
    const requiredDuration = Math.max(
      voiceSubtitleThresholds.minCueDurationSeconds,
      characterCount / voiceSubtitleThresholds.maxCharactersPerSecond,
    );
    if (end - start < requiredDuration) {
      end = Math.min(nextStart, start + requiredDuration);
    }
    if (end - start < requiredDuration) {
      start = Math.max(previousEnd, end - requiredDuration);
    }
    const duration = end - start;
    if (
      start < previousEnd ||
      end <= start ||
      end > audioDurationSeconds + voiceSubtitleThresholds.timingToleranceSeconds ||
      duration + voiceSubtitleThresholds.timingToleranceSeconds < requiredDuration ||
      duration >
        voiceSubtitleThresholds.maxCueDurationSeconds +
          voiceSubtitleThresholds.timingToleranceSeconds ||
      characterCount / duration >
        voiceSubtitleThresholds.maxCharactersPerSecond +
          voiceSubtitleThresholds.timingToleranceSeconds
    ) {
      throw new SafeExitError(
        `Voice subtitle cue ${index + 1} cannot satisfy readability and audio bounds.`,
      );
    }
    cues.push({ ...cue, startSeconds: roundMillis(start), endSeconds: roundMillis(end) });
    previousEnd = end;
  }
  return cues;
}

function splitCandidateForMaximumDuration(
  tokens: readonly DisplayToken[],
  preparation: VoiceoverPreparationV2,
  alignment: TtsCharacterAlignment,
  alignmentOffsets: readonly AlignmentOffset[],
): DisplayToken[][] {
  const bounds = candidateAlignmentBounds(tokens, preparation, alignment, alignmentOffsets);
  if (
    bounds.endSeconds - bounds.startSeconds <=
    voiceSubtitleThresholds.maxCueDurationSeconds + voiceSubtitleThresholds.timingToleranceSeconds
  ) {
    return [[...tokens]];
  }
  if (tokens.length < 2) {
    throw new SafeExitError("Voice subtitle token exceeds the maximum readable cue duration.");
  }
  const midpoint = (bounds.startSeconds + bounds.endSeconds) / 2;
  let splitIndex = 1;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 1; index < tokens.length; index += 1) {
    const right = tokens[index];
    if (!right) continue;
    const preparedBoundary = mapSourceBoundary(right.start, "start", preparation);
    const alignmentIndex = alignmentIndexRange(
      alignmentOffsets,
      preparedBoundary,
      preparedBoundary + 1,
    ).start;
    const boundarySeconds = alignment.characterStartTimesSeconds[alignmentIndex] ?? -1;
    const distance = Math.abs(boundarySeconds - midpoint);
    if (distance < bestDistance) {
      bestDistance = distance;
      splitIndex = index;
    }
  }
  return [
    ...splitCandidateForMaximumDuration(
      tokens.slice(0, splitIndex),
      preparation,
      alignment,
      alignmentOffsets,
    ),
    ...splitCandidateForMaximumDuration(
      tokens.slice(splitIndex),
      preparation,
      alignment,
      alignmentOffsets,
    ),
  ];
}

function candidateAlignmentBounds(
  tokens: readonly DisplayToken[],
  preparation: VoiceoverPreparationV2,
  alignment: TtsCharacterAlignment,
  alignmentOffsets: readonly AlignmentOffset[],
): { startSeconds: number; endSeconds: number } {
  const first = tokens[0];
  const last = tokens.at(-1);
  if (!first || !last) throw new SafeExitError("Voice subtitle cue is empty.");
  const preparedStart = mapSourceBoundary(first.start, "start", preparation);
  const preparedEnd = mapSourceBoundary(last.end, "end", preparation);
  const range = alignmentIndexRange(alignmentOffsets, preparedStart, preparedEnd);
  return {
    startSeconds: alignment.characterStartTimesSeconds[range.start] ?? -1,
    endSeconds: alignment.characterEndTimesSeconds[range.end] ?? -1,
  };
}
