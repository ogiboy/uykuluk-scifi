import { table } from "../../utils/markdown.js";
import type { DraftRenderManifest } from "../renderEvidence.js";

type TimelineInput = DraftRenderManifest["ffmpegTimelineInputs"][number];

/**
 * Builds timestamped review rows for the draft render review document.
 *
 * @param manifest - The draft render manifest to summarize.
 * @returns Markdown lines containing the timestamped review map.
 */
export function renderTimestampedReviewMap(manifest: DraftRenderManifest): string[] {
  let cursorSeconds = 0;
  const rows = manifest.ffmpegTimelineInputs.map((input) => {
    const startSeconds = cursorSeconds;
    cursorSeconds = roundSeconds(cursorSeconds + input.durationSeconds);
    return [
      `${formatTimestamp(startSeconds)}-${formatTimestamp(cursorSeconds)}`,
      segmentLabel(input),
      sourceLabel(input),
      input.asset.path,
      reviewFocus(input),
    ];
  });
  return [
    "## Timestamped Review Map",
    "",
    table(["Time", "Segment", "Source", "Asset", "Review focus"], rows),
    "",
  ];
}

/**
 * Formats a second offset for operator-facing MP4 review.
 *
 * @param seconds - The offset in seconds.
 * @returns A compact timestamp in `m:ss.ss` form.
 */
function formatTimestamp(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = (seconds - minutes * 60).toFixed(2).padStart(5, "0");
  return `${minutes}:${remainder}`;
}

/**
 * Labels a timeline input by segment and scene.
 *
 * @param input - The timeline input to label.
 * @returns A segment label for the timestamped review table.
 */
function segmentLabel(input: TimelineInput): string {
  return input.segment === "scene" ? `scene ${input.sceneIndex ?? "unknown"}` : input.segment;
}

/**
 * Labels whether a row came from a source frame or background plate.
 *
 * @param input - The timeline input to label.
 * @returns A source label.
 */
function sourceLabel(input: TimelineInput): string {
  return input.source === "source-frame" ? `source frame ${input.frameIndex ?? "?"}` : "background";
}

/**
 * Describes the operator review focus for a timeline row.
 *
 * @param input - The timeline input to describe.
 * @returns A short review instruction for the row.
 */
function reviewFocus(input: TimelineInput): string {
  if (input.segment === "intro") {
    return "intro title card timing and readability";
  }
  if (input.segment === "outro") {
    return "outro end screen timing and readability";
  }
  return "scene rhythm, subtitles, popup cards, and voiceover sync";
}

/**
 * Rounds a second value for stable timestamp output.
 *
 * @param seconds - The second value to round.
 * @returns The rounded value.
 */
function roundSeconds(seconds: number): number {
  return Math.round(seconds * 100) / 100;
}
