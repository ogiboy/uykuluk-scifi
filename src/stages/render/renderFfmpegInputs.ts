import type { AssetRef } from "./renderPlanSchemas.js";
import type { DraftRenderTimeline } from "./renderTimeline.js";

export type FfmpegTimelineInput = {
  asset: AssetRef;
  durationSeconds: number;
  frameIndex?: number;
  sceneIndex?: number;
  segment: DraftRenderTimeline[number]["segment"];
  source: "background" | "source-frame";
};

type SelectedTimelineAsset = {
  asset: AssetRef;
  frameIndex?: number;
  source: FfmpegTimelineInput["source"];
};

/**
 * Expands a draft render timeline into FFmpeg input segments.
 *
 * @param timeline - The timeline to convert.
 * @returns A flattened list of assets with per-segment durations and source-frame cadence metadata.
 */
export function buildFfmpegTimelineInputs(timeline: DraftRenderTimeline): FfmpegTimelineInput[] {
  return timeline.flatMap((item) => {
    const assets = timelineInputAssets(item);
    const durations = distributeDuration(item.durationSeconds, assets.length);
    return assets.map((asset, index) => ({
      asset: asset.asset,
      durationSeconds: durations[index],
      frameIndex: asset.frameIndex,
      sceneIndex: item.sceneIndex,
      segment: item.segment,
      source: asset.source,
    }));
  });
}

/**
 * Selects the assets used to represent a timeline item in FFmpeg input expansion.
 *
 * @param item - The timeline item to inspect.
 * @returns Source frame assets when they can receive at least 0.1 seconds each; otherwise the background asset.
 */
function timelineInputAssets(item: DraftRenderTimeline[number]): SelectedTimelineAsset[] {
  const frameAssets = item.sourceFrameAssets ?? [];
  if (frameAssets.length === 0) {
    return [{ asset: item.backgroundAsset, source: "background" }];
  }
  if (item.durationSeconds / frameAssets.length < 0.1) {
    return [{ asset: item.backgroundAsset, source: "background" }];
  }
  return frameAssets.map((asset, index) => ({
    asset,
    frameIndex: index + 1,
    source: "source-frame",
  }));
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
