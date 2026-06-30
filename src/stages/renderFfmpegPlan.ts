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
import { buildFfmpegTimelineInputs } from "./renderFfmpegInputs.js";
import { buildPopupTextFilters, hasPopupText } from "./renderFfmpegPopupText.js";

export { buildDraftRenderTimeline, clampRenderDuration } from "./renderTimeline.js";
export { buildFfmpegTimelineInputs } from "./renderFfmpegInputs.js";
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
  const ffmpegInputs = buildFfmpegTimelineInputs(timeline);
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
    renderPlan: input.renderPlan,
    sceneCount: ffmpegInputs.length,
    sceneFilters,
    subtitles,
    timeline,
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

/**
 * Builds read-only FFmpeg arguments for validating the final draft render output.
 *
 * @param outputPath - The validated draft render artifact path to inspect.
 * @returns FFmpeg arguments that read the artifact and discard decoded output.
 */
export function buildFfmpegReviewArgs(outputPath: string): string[] {
  return ["-v", "error", "-i", outputPath, "-f", "null", "-"];
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
  )}:force_style='FontSize=22,Outline=1,Shadow=0,Alignment=2,MarginV=86'[${input.outputLabel}]`;
}

function buildVideoFilter(input: {
  concatInputs: string;
  firstOverlayInputIndex: number;
  overlays: DraftRenderOverlay[];
  renderPlan: RenderPlan;
  sceneCount: number;
  sceneFilters: string[];
  subtitles: string;
  timeline: DraftRenderTimeline;
}): string {
  const includesPopupText = hasPopupText(input.renderPlan, input.timeline);
  const outputLabel = input.overlays.length > 0 || includesPopupText ? "base0" : "v";
  const filters = [
    ...input.sceneFilters,
    buildSubtitleConcatFilter({
      concatInputs: input.concatInputs,
      outputLabel,
      sceneCount: input.sceneCount,
      subtitles: input.subtitles,
    }),
  ];
  const overlayResult = overlayFilters({
    finalOutputLabel: includesPopupText ? "overlayOut" : "v",
    firstInputLabel: outputLabel,
    firstOverlayInputIndex: input.firstOverlayInputIndex,
    overlays: input.overlays,
  });
  return [
    ...filters,
    ...overlayResult.filters,
    ...buildPopupTextFilters({
      inputLabel: overlayResult.outputLabel,
      outputLabel: "v",
      renderPlan: input.renderPlan,
      timeline: input.timeline,
    }),
  ].join(";");
}

function overlayFilters(input: {
  finalOutputLabel: string;
  firstInputLabel: string;
  firstOverlayInputIndex: number;
  overlays: DraftRenderOverlay[];
}): { filters: string[]; outputLabel: string } {
  let inputLabel = input.firstInputLabel;
  const filters = input.overlays.flatMap((overlay, index) => {
    const scaledLabel = `ov${index}`;
    const outputLabel =
      index === input.overlays.length - 1 ? input.finalOutputLabel : `base${index + 1}`;
    const inputIndex = input.firstOverlayInputIndex + index;
    const filters = [
      `[${inputIndex}:v]scale=${overlay.width}:-1[${scaledLabel}]`,
      `[${inputLabel}][${scaledLabel}]overlay=${overlay.x}:${overlay.y}[${outputLabel}]`,
    ];
    inputLabel = outputLabel;
    return filters;
  });
  return {
    filters,
    outputLabel: filters.length > 0 ? inputLabel : input.firstInputLabel,
  };
}

const ffmpegFilterEscape = String.fromCodePoint(92);
const escapedFfmpegFilterEscape = `${ffmpegFilterEscape}${ffmpegFilterEscape}`;

function escapeFilterPath(value: string): string {
  return value
    .replaceAll(ffmpegFilterEscape, escapedFfmpegFilterEscape)
    .replaceAll(":", `${ffmpegFilterEscape}:`)
    .replaceAll("'", `${ffmpegFilterEscape}'`);
}
