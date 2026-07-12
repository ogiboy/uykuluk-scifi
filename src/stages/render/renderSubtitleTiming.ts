import { SafeExitError } from "../../core/errors.js";

export type DraftSubtitleTiming = {
  sourceDurationSeconds: number;
  sceneDurationSeconds: number;
  timeScale: number;
};

/**
 * Reads the final cue end time from an SRT document.
 *
 * @param subtitles - The complete SRT document.
 * @returns The final positive cue end time in seconds.
 */
export function parseSrtDurationSeconds(subtitles: string): number {
  let finalEndSeconds = 0;
  for (const line of subtitles.split(/\r?\n/u)) {
    const markerIndex = line.indexOf("-->");
    if (markerIndex === -1) {
      continue;
    }
    const end = line
      .slice(markerIndex + 3)
      .trim()
      .split(/\s+/u)[0];
    const seconds = parseSrtTimestamp(end ?? "");
    finalEndSeconds = Math.max(finalEndSeconds, seconds);
  }
  if (finalEndSeconds <= 0) {
    throw new SafeExitError("Draft render requires subtitles with a valid positive SRT duration.");
  }
  return roundMilliseconds(finalEndSeconds);
}

/**
 * Builds deterministic subtitle retiming evidence for the validated voiceover window.
 *
 * Piper does not provide word-level timestamps, so the V1 draft renderer linearly maps the source
 * SRT clock onto the actual audio duration and records the scale for operator review.
 *
 * @param sourceDurationSeconds - The final source SRT cue end time.
 * @param sceneDurationSeconds - The actual voiceover-backed scene window.
 * @returns Source, target, and linear subtitle-clock scale values.
 */
export function buildDraftSubtitleTiming(
  sourceDurationSeconds: number,
  sceneDurationSeconds: number,
): DraftSubtitleTiming {
  if (sourceDurationSeconds <= 0 || sceneDurationSeconds <= 0) {
    throw new SafeExitError("Draft subtitle timing requires positive source and scene durations.");
  }
  return {
    sourceDurationSeconds: roundMilliseconds(sourceDurationSeconds),
    sceneDurationSeconds: roundMilliseconds(sceneDurationSeconds),
    timeScale: Number((sourceDurationSeconds / sceneDurationSeconds).toFixed(6)),
  };
}

function parseSrtTimestamp(value: string): number {
  const parts = value.split(":");
  if (parts.length !== 3) {
    return 0;
  }
  const [hoursText, minutesText, secondsText] = parts;
  const secondParts = secondsText?.split(",") ?? [];
  if (secondParts.length !== 2) {
    return 0;
  }
  const [wholeSecondsText, millisecondsText] = secondParts;
  const values = [hoursText, minutesText, wholeSecondsText, millisecondsText].map(Number);
  if (values.some((item) => !Number.isFinite(item) || item < 0)) {
    return 0;
  }
  const [hours, minutes, wholeSeconds, milliseconds] = values as [number, number, number, number];
  if (minutes >= 60 || wholeSeconds >= 60 || milliseconds >= 1_000) {
    return 0;
  }
  return hours * 3_600 + minutes * 60 + wholeSeconds + milliseconds / 1_000;
}

function roundMilliseconds(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}
