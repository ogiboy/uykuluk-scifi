import { SafeExitError } from "../../../core/errors.js";
import { voiceSubtitleThresholds, type VoiceSubtitleSrtStats } from "./voiceSubtitleContracts.js";
import { visibleLength } from "./voiceSubtitleText.js";
import type { SubtitleCue } from "./voiceSubtitleTypes.js";

/** Validates a persisted SRT and returns its exact cue bounds. */
export function inspectVoiceSubtitleSrt(input: string): VoiceSubtitleSrtStats {
  const cues = parseAndValidateSrt(input, false);
  return {
    cueCount: cues.length,
    firstCueStartSeconds: cues[0]?.startSeconds ?? 0,
    lastCueEndSeconds: cues.at(-1)?.endSeconds ?? 0,
  };
}

export function renderSrt(cues: readonly SubtitleCue[]): string {
  return `${cues
    .map((cue) =>
      [
        String(cue.index),
        `${formatSrtTimestamp(cue.startSeconds)} --> ${formatSrtTimestamp(cue.endSeconds)}`,
        ...cue.lines,
      ].join("\n"),
    )
    .join("\n\n")}\n`;
}

export function parseAndValidateSrt(input: string, requireAudioBounds: boolean): SubtitleCue[] {
  const blocks = input
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .trim()
    .split(/\n{2,}/u);
  const cues = blocks.map((block, index) => {
    const lines = block.split("\n");
    const marker = lines[1]?.split("-->").map((part) => part.trim());
    const textLines = lines.slice(2);
    if (
      Number(lines[0]) !== index + 1 ||
      marker?.length !== 2 ||
      textLines.length < 1 ||
      textLines.length > voiceSubtitleThresholds.maxLinesPerCue ||
      textLines.some((line) => visibleLength(line) > voiceSubtitleThresholds.maxCharactersPerLine)
    ) {
      throw new SafeExitError("Voice subtitle SRT does not satisfy the readable cue contract.");
    }
    return {
      index: index + 1,
      startSeconds: parseSrtTimestamp(marker[0] ?? ""),
      endSeconds: parseSrtTimestamp(marker[1] ?? ""),
      lines: textLines,
    };
  });
  let previousEnd = 0;
  for (const cue of cues) {
    if (cue.startSeconds < previousEnd || cue.endSeconds <= cue.startSeconds) {
      throw new SafeExitError("Voice subtitle SRT cues must be positive and non-overlapping.");
    }
    previousEnd = cue.endSeconds;
  }
  if (cues.length === 0 || (requireAudioBounds && previousEnd <= 0)) {
    throw new SafeExitError("Voice subtitle SRT must contain at least one timed cue.");
  }
  return cues;
}

function parseSrtTimestamp(value: string): number {
  const match = /^(\d{2}):(\d{2}):(\d{2}),(\d{3})$/u.exec(value);
  if (!match) throw new SafeExitError("Voice subtitle SRT contains an invalid timestamp.");
  const [, hoursText, minutesText, secondsText, millisecondsText] = match;
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  const seconds = Number(secondsText);
  const milliseconds = Number(millisecondsText);
  if (minutes >= 60 || seconds >= 60) {
    throw new SafeExitError("Voice subtitle SRT contains an invalid timestamp.");
  }
  return hours * 3_600 + minutes * 60 + seconds + milliseconds / 1_000;
}

function formatSrtTimestamp(value: number): string {
  const millisecondsTotal = Math.max(0, Math.round(value * 1_000));
  const hours = Math.floor(millisecondsTotal / 3_600_000);
  const minutes = Math.floor((millisecondsTotal % 3_600_000) / 60_000);
  const seconds = Math.floor((millisecondsTotal % 60_000) / 1_000);
  const milliseconds = millisecondsTotal % 1_000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},${String(milliseconds).padStart(3, "0")}`;
}
