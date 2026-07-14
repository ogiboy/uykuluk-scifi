import { SafeExitError } from "../../core/errors.js";

type DraftSubtitleTimingBase = { sourceDurationSeconds: number; sceneDurationSeconds: number };

export type DraftSubtitleTiming =
  | (DraftSubtitleTimingBase & { timingMode: "linear-fallback"; timeScale: number })
  | (DraftSubtitleTimingBase & { timingMode: "elevenlabs-character-aligned"; timeScale: 1 });

export type DraftSubtitleTimingMode = DraftSubtitleTiming["timingMode"];

type DraftSubtitleTimingInput = DraftSubtitleTimingBase & {
  timingMode: DraftSubtitleTimingMode;
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
 * Local fallback subtitles linearly map their source clock onto the voiceover window. ElevenLabs
 * character-aligned subtitles retain their provider-derived clock and must end within that window.
 *
 * @param sourceDurationSeconds - The final source SRT cue end time.
 * @param sceneDurationSeconds - The actual voiceover-backed scene window.
 * @param timingMode - The validated subtitle timing strategy.
 * @returns Source, target, timing mode, and subtitle-clock scale values.
 */
export function buildDraftSubtitleTiming(
  sourceDurationSeconds: number,
  sceneDurationSeconds: number,
  timingMode: DraftSubtitleTimingMode,
): DraftSubtitleTiming {
  const sourceDuration = roundMilliseconds(sourceDurationSeconds);
  const sceneDuration = roundMilliseconds(sceneDurationSeconds);
  if (sourceDuration <= 0 || sceneDuration <= 0) {
    throw new SafeExitError("Draft subtitle timing requires positive source and scene durations.");
  }
  if (timingMode === "elevenlabs-character-aligned") {
    return validateDraftSubtitleTiming({
      timingMode,
      sourceDurationSeconds: sourceDuration,
      sceneDurationSeconds: sceneDuration,
      timeScale: 1,
    });
  }
  return validateDraftSubtitleTiming({
    timingMode,
    sourceDurationSeconds: sourceDuration,
    sceneDurationSeconds: sceneDuration,
    timeScale: Number((sourceDuration / sceneDuration).toFixed(6)),
  });
}

/** Validates a caller-provided timing descriptor before it reaches FFmpeg planning. */
export function validateDraftSubtitleTiming(timing: DraftSubtitleTimingInput): DraftSubtitleTiming {
  if (timing.sourceDurationSeconds <= 0 || timing.sceneDurationSeconds <= 0) {
    throw new SafeExitError("Draft subtitle timing requires positive source and scene durations.");
  }
  if (timing.timingMode === "elevenlabs-character-aligned") {
    if (timing.timeScale !== 1 || timing.sourceDurationSeconds > timing.sceneDurationSeconds) {
      throw new SafeExitError(
        "Character-aligned subtitle timing must remain unscaled and within the scene audio window.",
      );
    }
    return { ...timing, timeScale: 1 };
  }
  const expectedScale = Number(
    (timing.sourceDurationSeconds / timing.sceneDurationSeconds).toFixed(6),
  );
  if (timing.timeScale !== expectedScale) {
    throw new SafeExitError("Linear fallback subtitle timing scale is inconsistent.");
  }
  return { ...timing, timingMode: "linear-fallback" };
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
