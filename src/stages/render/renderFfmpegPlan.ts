import path from "node:path";
import { artifactPath } from "../../core/artifacts.js";
import { SafeExitError } from "../../core/errors.js";
import { voiceoverAudioPath } from "../voice/voiceoverEvidence.js";
import {
  buildDraftRenderComposition,
  type DraftRenderComposition,
  type DraftRenderOverlay,
} from "./renderComposition.js";
import { buildFfmpegTimelineInputs } from "./renderFfmpegInputs.js";
import { buildTimedOverlayFilters } from "./renderFfmpegOverlays.js";
import { buildPopupTextFilters, hasPopupText, popupTextWindows } from "./renderFfmpegPopupText.js";
import { buildSubtitleConcatFilter } from "./renderFfmpegSubtitles.js";
import { RenderPlan } from "./renderPlanSchemas.js";
import { validateDraftSubtitleTiming, type DraftSubtitleTiming } from "./renderSubtitleTiming.js";
import {
  buildDraftRenderTimeline,
  summarizeDraftRenderTimeline,
  type DraftRenderTimeline,
  type DraftRenderTiming,
} from "./renderTimeline.js";

export { buildFfmpegTimelineInputs } from "./renderFfmpegInputs.js";
export {
  buildDraftRenderTimeline,
  clampRenderDuration,
  draftRenderTargetDuration,
  summarizeDraftRenderTimeline,
} from "./renderTimeline.js";
export type { DraftRenderTimeline, DraftRenderTiming } from "./renderTimeline.js";

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
  subtitleArtifactPath: string;
  subtitleTiming: DraftSubtitleTiming;
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
  const timing = summarizeDraftRenderTimeline(timeline);
  if (Math.abs(timing.totalDurationSeconds - input.durationSeconds) > 0.01) {
    throw new SafeExitError("Draft render duration does not match its timeline.");
  }
  const subtitleTiming = validateDraftSubtitleTiming(input.subtitleTiming);
  if (Math.abs(subtitleTiming.sceneDurationSeconds - timing.sceneAudioDurationSeconds) > 0.01) {
    throw new SafeExitError("Draft subtitle timing does not match the scene-audio window.");
  }
  const audio = artifactPath(input.runId, voiceoverAudioPath);
  const subtitles = artifactPath(input.runId, input.subtitleArtifactPath);
  const audioInputIndex = ffmpegInputs.length;
  const sceneFilters = ffmpegInputs.map((item, index) =>
    sceneInputFilter(item, index, input.renderPlan.format.fps, input.renderPlan.format.resolution),
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
    subtitleTiming,
    timing,
    timeline,
  });
  const audioFilter = buildAudioFilter(audioInputIndex, timing);
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
    `${audioFilter};${filter}`,
    "-map",
    "[v]",
    "-map",
    "[a]",
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

function sceneInputFilter(
  item: ReturnType<typeof buildFfmpegTimelineInputs>[number],
  index: number,
  fps: number,
  resolution: RenderPlan["format"]["resolution"],
): string {
  const prefix = `[${index}:v]`;
  const suffix = `setsar=1,trim=duration=${item.durationSeconds},setpts=PTS-STARTPTS[s${index}]`;
  const { width, height } = renderDimensions(resolution);
  if (!item.motion || item.source === "source-frame") {
    return `${prefix}scale=${width}:${height},${suffix}`;
  }
  const frames = Math.max(1, Math.round(item.durationSeconds * fps));
  const frameDenominator = Math.max(1, frames - 1);
  const zoomDelta = Math.abs(item.motion.zoomEnd - item.motion.zoomStart) / frameDenominator;
  const zoom = zoomExpression(item.motion, zoomDelta);
  const x = panExpression(item.motion.pan, frameDenominator);
  return `${prefix}zoompan=z='${zoom}':x='${x}':y='(ih-ih/zoom)/2':d=1:s=${width}x${height}:fps=${fps},${suffix}`;
}

function zoomExpression(
  motion: NonNullable<ReturnType<typeof buildFfmpegTimelineInputs>[number]["motion"]>,
  zoomDelta: number,
): string {
  const delta = zoomDelta.toFixed(7);
  if (motion.kind === "slow-zoom-in") {
    return `if(eq(on\\,0)\\,${motion.zoomStart}\\,min(zoom+${delta}\\,${motion.zoomEnd}))`;
  }
  if (motion.kind === "slow-zoom-out") {
    return `if(eq(on\\,0)\\,${motion.zoomStart}\\,max(zoom-${delta}\\,${motion.zoomEnd}))`;
  }
  return String(motion.zoomStart);
}

function panExpression(
  pan: NonNullable<ReturnType<typeof buildFfmpegTimelineInputs>[number]["motion"]>["pan"],
  frameDenominator: number,
): string {
  if (pan === "left") {
    return `(iw-iw/zoom)*(1-on/${frameDenominator})`;
  }
  if (pan === "right") {
    return `(iw-iw/zoom)*(on/${frameDenominator})`;
  }
  return `(iw-iw/zoom)/2`;
}

function renderDimensions(resolution: RenderPlan["format"]["resolution"]): {
  width: number;
  height: number;
} {
  const [width, height] = resolution.split("x").map(Number);
  if (!width || !height) {
    throw new SafeExitError(`Unsupported render resolution: ${resolution}.`);
  }
  return { width, height };
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

function buildVideoFilter(input: {
  concatInputs: string;
  firstOverlayInputIndex: number;
  overlays: DraftRenderOverlay[];
  renderPlan: RenderPlan;
  sceneCount: number;
  sceneFilters: string[];
  subtitles: string;
  subtitleTiming: DraftSubtitleTiming;
  timing: DraftRenderTiming;
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
      subtitleTiming: input.subtitleTiming,
      timing: input.timing,
    }),
  ];
  const popupWindows = popupTextWindows(input.renderPlan, input.timeline);
  const overlayResult = buildTimedOverlayFilters({
    finalOutputLabel: includesPopupText ? "overlayOut" : "v",
    firstInputLabel: outputLabel,
    firstOverlayInputIndex: input.firstOverlayInputIndex,
    overlays: input.overlays,
    popupWindows,
    timing: input.timing,
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

function buildAudioFilter(audioInputIndex: number, timing: DraftRenderTiming): string {
  const sceneDuration = formatSeconds(timing.sceneAudioDurationSeconds);
  const totalDuration = formatSeconds(timing.totalDurationSeconds);
  const introDelayMilliseconds = Math.round(timing.introDurationSeconds * 1_000);
  return `[${audioInputIndex}:a]atrim=duration=${sceneDuration},asetpts=PTS-STARTPTS,apad=whole_dur=${sceneDuration},atrim=duration=${sceneDuration},adelay=${introDelayMilliseconds}:all=1,apad=whole_dur=${totalDuration},atrim=duration=${totalDuration}[a]`;
}

function formatSeconds(value: number): string {
  return Number(value.toFixed(2)).toString();
}
