import { SafeExitError } from "../../core/errors.js";
import type { DraftSubtitleTiming } from "./renderSubtitleTiming.js";
import type { DraftRenderTiming } from "./renderTimeline.js";

export function buildSubtitleConcatFilter(input: {
  concatInputs: string;
  outputLabel: string;
  sceneCount: number;
  subtitles: string;
  subtitleTiming: DraftSubtitleTiming;
  timing: DraftRenderTiming;
}): string {
  if (input.sceneCount < 1) {
    throw new SafeExitError("Draft subtitle filter requires at least one video segment.");
  }
  const concat = `${input.concatInputs}concat=n=${input.sceneCount}:v=1:a=0`;
  const subtitleFilter = `subtitles=${escapeFilterPath(
    input.subtitles,
  )}:force_style='FontSize=22,Outline=1,Shadow=0,Alignment=2,MarginV=86'`;
  const scale = formatScale(input.subtitleTiming.timeScale);
  const scaledSubtitleFilter = `setpts=(PTS-STARTPTS)*${scale},${subtitleFilter},setpts=(PTS-STARTPTS)/${scale}`;
  if (input.timing.introDurationSeconds === 0 && input.timing.outroDurationSeconds === 0) {
    return `${concat},${scaledSubtitleFilter}[${input.outputLabel}]`;
  }

  const segments = subtitleSegments(input.timing);
  const splitSources = segments.map((segment) => `[subtitle${capitalize(segment.kind)}Source]`);
  const filters = [
    `${concat}[subtitleTimeline]`,
    `[subtitleTimeline]split=${segments.length}${splitSources.join("")}`,
    ...segments.map((segment) => subtitleSegmentFilter(segment, scaledSubtitleFilter)),
    `${segments
      .map((segment) => `[subtitle${capitalize(segment.kind)}]`)
      .join("")}concat=n=${segments.length}:v=1:a=0[${input.outputLabel}]`,
  ];
  return filters.join(";");
}

type SubtitleSegment = { end: number; kind: "intro" | "outro" | "scene"; start: number };

function subtitleSegments(timing: DraftRenderTiming): SubtitleSegment[] {
  const segments: SubtitleSegment[] = [];
  const sceneStart = timing.introDurationSeconds;
  const sceneEnd = sceneStart + timing.sceneAudioDurationSeconds;
  if (timing.introDurationSeconds > 0) {
    segments.push({ end: sceneStart, kind: "intro", start: 0 });
  }
  segments.push({ end: sceneEnd, kind: "scene", start: sceneStart });
  if (timing.outroDurationSeconds > 0) {
    segments.push({ end: timing.totalDurationSeconds, kind: "outro", start: sceneEnd });
  }
  return segments;
}

function subtitleSegmentFilter(segment: SubtitleSegment, scaledSubtitleFilter: string): string {
  const source = `subtitle${capitalize(segment.kind)}Source`;
  const output = `subtitle${capitalize(segment.kind)}`;
  const base = `[${source}]trim=start=${formatSeconds(segment.start)}:end=${formatSeconds(
    segment.end,
  )},setpts=PTS-STARTPTS`;
  return segment.kind === "scene"
    ? `${base},${scaledSubtitleFilter}[${output}]`
    : `${base}[${output}]`;
}

const ffmpegFilterEscape = String.fromCodePoint(92);
const escapedFfmpegFilterEscape = `${ffmpegFilterEscape}${ffmpegFilterEscape}`;

function escapeFilterPath(value: string): string {
  return value
    .replaceAll(ffmpegFilterEscape, escapedFfmpegFilterEscape)
    .replaceAll(":", `${ffmpegFilterEscape}:`)
    .replaceAll("'", `${ffmpegFilterEscape}'`);
}

function formatSeconds(value: number): string {
  return Number(value.toFixed(2)).toString();
}

function formatScale(value: number): string {
  return Number(value.toFixed(6)).toString();
}

function capitalize(value: SubtitleSegment["kind"]): "Intro" | "Outro" | "Scene" {
  switch (value) {
    case "intro":
      return "Intro";
    case "outro":
      return "Outro";
    case "scene":
      return "Scene";
  }
}
