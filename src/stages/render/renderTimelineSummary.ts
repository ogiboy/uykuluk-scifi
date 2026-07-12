import type { DraftRenderManifest } from "../renderEvidence.js";

/**
 * Counts the source frame assets used across a timeline.
 *
 * @param timeline - The draft render timeline to inspect
 * @returns The total number of source frame assets across all timeline items
 */
export function sourceFrameCount(timeline: DraftRenderManifest["timeline"]): number {
  return timeline.reduce((total, item) => total + (item.sourceFrameAssets?.length ?? 0), 0);
}

/**
 * Builds source-frame segment labels for a timeline.
 *
 * @param timeline - The draft render timeline to inspect
 * @returns Labels in the form `segment:count` for timeline items that include source-frame assets
 */
export function sourceFrameSegments(timeline: DraftRenderManifest["timeline"]): string[] {
  return timeline.flatMap((item) => {
    const count = item.sourceFrameAssets?.length ?? 0;
    return count > 0 ? [`${timelineSegmentLabel(item)}:${count}`] : [];
  });
}

/**
 * Builds exact source-frame cadence labels from FFmpeg timeline input metadata.
 *
 * @param inputs - The FFmpeg timeline inputs persisted in the draft render manifest.
 * @returns Human-readable labels for source-frame inputs only.
 */
export function sourceFrameCadence(inputs: DraftRenderManifest["ffmpegTimelineInputs"]): string[] {
  return inputs.flatMap((input) =>
    input.source === "source-frame"
      ? [
          `${timelineInputLabel(input)}#${input.frameIndex ?? "?"}=${input.durationSeconds}s ${input.asset.path}`,
        ]
      : [],
  );
}

/**
 * Labels a timeline item by segment.
 *
 * @param item - The timeline item to label
 * @returns A segment label, using `scene-<index>` for scene items
 */
function timelineSegmentLabel(item: DraftRenderManifest["timeline"][number]): string {
  if (item.segment === "scene") {
    return `scene-${item.sceneIndex ?? "unknown"}`;
  }
  return item.segment ?? "scene";
}

/**
 * Labels a persisted FFmpeg timeline input by segment.
 *
 * @param input - The FFmpeg timeline input to label.
 * @returns A compact segment label for operator-facing cadence strings.
 */
function timelineInputLabel(input: DraftRenderManifest["ffmpegTimelineInputs"][number]): string {
  if (input.segment === "scene") {
    return `scene-${input.sceneIndex ?? "unknown"}`;
  }
  return input.segment;
}
