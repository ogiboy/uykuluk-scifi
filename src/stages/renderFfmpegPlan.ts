import path from "node:path";
import { artifactPath } from "../core/artifacts.js";
import { SafeExitError } from "../core/errors.js";
import { voiceoverAudioPath } from "./voiceoverEvidence.js";
import { AssetRef, RenderPlan } from "./renderPlanSchemas.js";

type DraftRenderTimeline = Array<{
  sceneIndex: number;
  durationSeconds: number;
  backgroundAsset: AssetRef;
}>;

export function buildFfmpegArgs(input: {
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
  const audio = artifactPath(input.runId, voiceoverAudioPath);
  const subtitles = artifactPath(input.runId, "production/subtitles.srt");
  const watermark = firstScene.overlayAssets.find((asset) => asset.role === "watermark");
  const audioInputIndex = timeline.length;
  const watermarkInputIndex = audioInputIndex + 1;
  const sceneFilters = timeline.map(
    (item, index) =>
      `[${index}:v]scale=1280:720,setsar=1,trim=duration=${item.durationSeconds},setpts=PTS-STARTPTS[s${index}]`,
  );
  const concatInputs = timeline.map((_, index) => `[s${index}]`).join("");
  const subtitleBaseFilter = buildSubtitleConcatFilter({
    concatInputs,
    outputLabel: "base",
    sceneCount: timeline.length,
    subtitles,
  });
  const subtitleVideoFilter = buildSubtitleConcatFilter({
    concatInputs,
    outputLabel: "v",
    sceneCount: timeline.length,
    subtitles,
  });
  const filter = watermark
    ? [
        ...sceneFilters,
        subtitleBaseFilter,
        `[${watermarkInputIndex}:v]scale=120:-1[wm]`,
        "[base][wm]overlay=W-w-24:24[v]",
      ].join(";")
    : [...sceneFilters, subtitleVideoFilter].join(";");
  const args = ["-y"];
  for (const item of timeline) {
    args.push(
      "-loop",
      "1",
      "-t",
      String(item.durationSeconds),
      "-i",
      path.join(process.cwd(), item.backgroundAsset.path),
    );
  }
  args.push("-i", audio);
  if (watermark) {
    args.push("-i", path.join(process.cwd(), watermark.path));
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

export function buildDraftRenderTimeline(
  renderPlan: RenderPlan,
  targetDurationSeconds: number,
): DraftRenderTimeline {
  if (renderPlan.scenes.length === 0) {
    throw new SafeExitError("Draft render requires at least one render-plan scene.");
  }
  const targetDuration = positiveDuration(targetDurationSeconds);
  const timeline: DraftRenderTimeline = [];
  let remainingSeconds = targetDuration;
  for (const scene of renderPlan.scenes) {
    if (remainingSeconds <= 0) {
      break;
    }
    const durationSeconds = positiveDuration(Math.min(scene.durationSeconds, remainingSeconds));
    if (durationSeconds > 0) {
      timeline.push({
        sceneIndex: scene.sceneIndex,
        durationSeconds,
        backgroundAsset: scene.backgroundAsset,
      });
      remainingSeconds = roundSeconds(remainingSeconds - durationSeconds);
    }
  }
  if (remainingSeconds > 0) {
    extendLastTimelineScene(timeline, renderPlan, remainingSeconds);
  }
  return timeline;
}

export function clampRenderDuration(actualSeconds: number, maxSeconds?: number): number {
  if (!maxSeconds || maxSeconds <= 0) {
    return positiveDuration(actualSeconds);
  }
  return positiveDuration(Math.min(actualSeconds, maxSeconds));
}

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

function extendLastTimelineScene(
  timeline: DraftRenderTimeline,
  renderPlan: RenderPlan,
  remainingSeconds: number,
): void {
  const lastTimelineItem = timeline.at(-1);
  if (lastTimelineItem) {
    timeline[timeline.length - 1] = {
      ...lastTimelineItem,
      durationSeconds: positiveDuration(lastTimelineItem.durationSeconds + remainingSeconds),
    };
    return;
  }
  const firstScene = renderPlan.scenes[0];
  if (!firstScene) {
    throw new SafeExitError("Draft render requires at least one render-plan scene.");
  }
  timeline.push({
    sceneIndex: firstScene.sceneIndex,
    durationSeconds: positiveDuration(remainingSeconds),
    backgroundAsset: firstScene.backgroundAsset,
  });
}

function positiveDuration(seconds: number): number {
  return Math.max(0.1, roundSeconds(seconds));
}

function roundSeconds(seconds: number): number {
  return Math.round(seconds * 100) / 100;
}

const ffmpegFilterEscape = String.fromCodePoint(92);
const escapedFfmpegFilterEscape = `${ffmpegFilterEscape}${ffmpegFilterEscape}`;

function escapeFilterPath(value: string): string {
  return value
    .replaceAll(ffmpegFilterEscape, escapedFfmpegFilterEscape)
    .replaceAll(":", `${ffmpegFilterEscape}:`)
    .replaceAll("'", `${ffmpegFilterEscape}'`);
}
