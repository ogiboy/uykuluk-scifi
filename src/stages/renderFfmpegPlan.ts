import path from "node:path";
import { artifactPath } from "../core/artifacts.js";
import { SafeExitError } from "../core/errors.js";
import { voiceoverAudioPath } from "./voiceoverEvidence.js";
import { RenderPlan } from "./renderPlanSchemas.js";
import {
  buildDraftRenderComposition,
  type DraftRenderComposition,
  type DraftRenderOverlay,
} from "./renderComposition.js";
import { buildDraftRenderTimeline, type DraftRenderTimeline } from "./renderTimeline.js";
import type { AssetRef } from "./renderPlanSchemas.js";

export { buildDraftRenderTimeline, clampRenderDuration } from "./renderTimeline.js";
export type { DraftRenderTimeline } from "./renderTimeline.js";

/**
 * Builds FFmpeg arguments for rendering a draft video.
 *
 * Uses the provided timeline or derives one from the render plan, then assembles the inputs,
 * filters, stream mappings, and output settings needed to write the final file.
 *
 * @throws {SafeExitError} Thrown when the render plan does not contain at least one scene.
 * @returns The FFmpeg command-line arguments.
 */
export function buildFfmpegArgs(input: {
  composition?: DraftRenderComposition;
  durationSeconds: number;
  ffmpegOutputPath: string;
  renderPlan: RenderPlan;
  runId: string;
  timeline?: DraftRenderTimeline;
}): string[] {
  const timeline =
    input.timeline ?? buildDraftRenderTimeline(input.renderPlan, input.durationSeconds);
  const firstScene = input.renderPlan.scenes[0];
  const firstTimelineItem = timeline[0];
  if (!firstScene || !firstTimelineItem) {
    throw new SafeExitError("Draft render requires at least one render-plan scene.");
  }
  const composition = input.composition ?? buildDraftRenderComposition(input.renderPlan);
  const ffmpegInputs = expandTimelineInputs(timeline);
  const audio = artifactPath(input.runId, voiceoverAudioPath);
  const subtitles = artifactPath(input.runId, "production/subtitles.srt");
  const audioInputIndex = ffmpegInputs.length;
  const sceneFilters = ffmpegInputs.map(
    (item, index) =>
      `[${index}:v]scale=1280:720,setsar=1,trim=duration=${item.durationSeconds},setpts=PTS-STARTPTS[s${index}]`,
  );
  const concatInputs = ffmpegInputs.map((_, index) => `[s${index}]`).join("");
  const filter = buildVideoFilter({
    concatInputs,
    firstOverlayInputIndex: audioInputIndex + 1,
    overlays: composition.overlays,
    sceneCount: ffmpegInputs.length,
    sceneFilters,
    subtitles,
  });
  const args = ["-y"];
  for (const item of ffmpegInputs) {
    args.push(
      "-loop",
      "1",
      "-t",
      String(item.durationSeconds),
      "-i",
      path.join(process.cwd(), item.asset.path),
    );
  }
  args.push("-i", audio);
  for (const overlay of composition.overlays) {
    args.push("-i", path.join(process.cwd(), overlay.asset.path));
  }
  args.push(
    "-filter_complex",
    filter,
    "-map",
    "[v]",
    "-map",
    `${audioInputIndex}:a`,
    "-t",
    String(input.durationSeconds),
    "-r",
    String(input.renderPlan.format.fps),
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-movflags",
    "+faststart",
    input.ffmpegOutputPath,
  );
  return args;
}

type FfmpegTimelineInput = {
  asset: AssetRef;
  durationSeconds: number;
};

/**
 * Expands a draft render timeline into FFmpeg input segments.
 *
 * @param timeline - The timeline to convert.
 * @returns A flattened list of assets with per-segment durations.
 */
function expandTimelineInputs(timeline: DraftRenderTimeline): FfmpegTimelineInput[] {
  return timeline.flatMap((item) => {
    const assets = timelineInputAssets(item);
    const durations = distributeDuration(item.durationSeconds, assets.length);
    return assets.map((asset, index) => ({
      asset,
      durationSeconds: durations[index]!,
    }));
  });
}

/**
 * Selects the assets used to represent a timeline item in FFmpeg input expansion.
 *
 * @param item - The timeline item to inspect.
 * @returns The source frame assets when there is more than one and each receives at least 0.1 seconds; otherwise the background asset.
 */
function timelineInputAssets(item: DraftRenderTimeline[number]): AssetRef[] {
  const frameAssets = item.sourceFrameAssets ?? [];
  if (frameAssets.length === 0) {
    return [item.backgroundAsset];
  }
  if (item.durationSeconds / frameAssets.length < 0.1) {
    return [item.backgroundAsset];
  }
  return frameAssets;
}

/**
 * Splits a duration across a number of segments.
 *
 * @param durationSeconds - The total duration to distribute.
 * @param itemCount - The number of segments to produce.
 * @returns An array of durations whose sum matches `durationSeconds` after rounding.
 */
function distributeDuration(durationSeconds: number, itemCount: number): number[] {
  if (itemCount <= 1) {
    return [roundSeconds(durationSeconds)];
  }
  const baseDuration = roundSeconds(durationSeconds / itemCount);
  const durations = Array.from({ length: itemCount }, () => baseDuration);
  const usedDuration = roundSeconds(baseDuration * (itemCount - 1));
  durations[itemCount - 1] = roundSeconds(durationSeconds - usedDuration);
  return durations;
}

/**
 * Rounds a duration to two decimal places.
 *
 * @param seconds - The duration in seconds.
 * @returns The duration rounded to the nearest hundredth.
 */
function roundSeconds(seconds: number): number {
  return Math.round(seconds * 100) / 100;
}

/**
 * Creates a concat and subtitles filter chain for a single labeled output.
 *
 * @param input.concatInputs - The FFmpeg input label sequence for the concat filter.
 * @param input.outputLabel - The label assigned to the filter output.
 * @param input.sceneCount - The number of concatenated video segments.
 * @param input.subtitles - The subtitles file path.
 * @returns The FFmpeg filter expression.
 */
function buildSubtitleConcatFilter(input: {
  concatInputs: string;
  outputLabel: string;
  sceneCount: number;
  subtitles: string;
}): string {
  return `${input.concatInputs}concat=n=${input.sceneCount}:v=1:a=0,subtitles=${escapeFilterPath(
    input.subtitles,
  )}[${input.outputLabel}]`;
}

function buildVideoFilter(input: {
  concatInputs: string;
  firstOverlayInputIndex: number;
  overlays: DraftRenderOverlay[];
  sceneCount: number;
  sceneFilters: string[];
  subtitles: string;
}): string {
  const outputLabel = input.overlays.length > 0 ? "base0" : "v";
  const filters = [
    ...input.sceneFilters,
    buildSubtitleConcatFilter({
      concatInputs: input.concatInputs,
      outputLabel,
      sceneCount: input.sceneCount,
      subtitles: input.subtitles,
    }),
  ];
  return [
    ...filters,
    ...overlayFilters(input.overlays, input.firstOverlayInputIndex, outputLabel),
  ].join(";");
}

function overlayFilters(
  overlays: DraftRenderOverlay[],
  firstOverlayInputIndex: number,
  firstInputLabel: string,
): string[] {
  let inputLabel = firstInputLabel;
  return overlays.flatMap((overlay, index) => {
    const scaledLabel = `ov${index}`;
    const outputLabel = index === overlays.length - 1 ? "v" : `base${index + 1}`;
    const inputIndex = firstOverlayInputIndex + index;
    const filters = [
      `[${inputIndex}:v]scale=${overlay.width}:-1[${scaledLabel}]`,
      `[${inputLabel}][${scaledLabel}]overlay=${overlay.x}:${overlay.y}[${outputLabel}]`,
    ];
    inputLabel = outputLabel;
    return filters;
  });
}

const ffmpegFilterEscape = String.fromCodePoint(92);
const escapedFfmpegFilterEscape = `${ffmpegFilterEscape}${ffmpegFilterEscape}`;

function escapeFilterPath(value: string): string {
  return value
    .replaceAll(ffmpegFilterEscape, escapedFfmpegFilterEscape)
    .replaceAll(":", `${ffmpegFilterEscape}:`)
    .replaceAll("'", `${ffmpegFilterEscape}'`);
}
