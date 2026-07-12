import { bulletList, table } from "../../utils/markdown.js";
import type { ChannelHandoff } from "./channelHandoffContracts.js";

/**
 * Renders the manual channel handoff package as operator Markdown.
 *
 * @param handoff - The validated manual handoff package.
 * @returns Operator-readable Markdown for manual channel review.
 */
export function renderChannelHandoffMarkdown(handoff: ChannelHandoff): string {
  return [
    "# Manual Channel Handoff",
    "",
    `Run: ${handoff.runId}`,
    `Status: ${handoff.status}`,
    `Created at: ${handoff.createdAt}`,
    "",
    "> Local preparation artifact only. This does not upload, schedule, publish, or grant upload/publish approval.",
    "",
    "## Video Files",
    "",
    table(
      ["Field", "Value"],
      [
        ["Draft MP4", handoff.media.draftRenderPath],
        ["SHA-256", handoff.media.draftRenderSha256],
        ["Duration", `${handoff.media.durationSeconds}s`],
        ["Subtitles", handoff.media.subtitlesPath],
        ["Render review", handoff.media.renderReviewPath],
        ["YouTube chapter draft", handoff.media.chaptersPath],
      ],
    ),
    "",
    "## YouTube Metadata Draft",
    "",
    table(
      ["Field", "Value"],
      [
        ["Metadata JSON", handoff.youtube.metadataPath],
        ["Title", escapeTableCell(handoff.youtube.title)],
        ["Tags", escapeTableCell(handoff.youtube.tags.join(", "))],
      ],
    ),
    "",
    "Description:",
    "",
    codeBlock(handoff.youtube.description),
    "",
    "## Manual Upload Preparation",
    "",
    "> Copy these fields only after the local review is complete and a future private-upload approval path exists.",
    "",
    "Title:",
    "",
    codeBlock(handoff.youtube.title),
    "",
    "Description:",
    "",
    codeBlock(handoff.youtube.description),
    "",
    "Tags:",
    "",
    codeBlock(handoff.youtube.tags.join(", ")),
    "",
    table(
      ["Input", "Local path"],
      [
        ["Video file", handoff.media.draftRenderPath],
        ["Subtitle file", handoff.media.subtitlesPath],
        ["Chapter draft", handoff.media.chaptersPath],
        ["Thumbnail candidates", handoff.thumbnailCandidates.markdownPath],
        ["Metadata JSON", handoff.youtube.metadataPath],
        ["Final review Markdown", handoff.finalReviewBundle.markdownPath],
        ["Manual handoff Markdown", "production/channel_handoff.md"],
      ],
    ),
    "",
    "## Thumbnail Preparation",
    "",
    bulletList([
      `Review ${handoff.thumbnailCandidates.markdownPath} and choose or revise one tracked thumbnail candidate manually.`,
      `Recommended starting candidate: ${handoff.thumbnailCandidates.recommendedCandidateId}.`,
      "Confirm title-safe areas, contrast, channel tone, and no misleading visual claim.",
      "Keep the selected thumbnail path as operator evidence before any future upload approval.",
    ]),
    "",
    "## Source Review Evidence",
    "",
    table(
      ["Field", "Value"],
      [
        ["Final review bundle", handoff.finalReviewBundle.path],
        ["Final review Markdown", handoff.finalReviewBundle.markdownPath],
        ["Final review digest", handoff.finalReviewBundle.digest],
        ["Final review status", handoff.finalReviewBundle.status],
      ],
    ),
    "",
    "## Operator Checklist",
    "",
    bulletList(handoff.operatorChecklist),
    "",
    "## Still Blocked",
    "",
    bulletList(handoff.blockedActions),
    "",
    "## Next Safe Action",
    "",
    handoff.nextSafeAction,
  ].join("\n");
}

function codeBlock(value: string): string {
  const fence = fenceFor(value);
  return [`${fence}text`, value, fence].join("\n");
}

function escapeTableCell(value: string): string {
  return value.replaceAll("|", String.raw`\|`).replaceAll("\n", "<br>");
}

function fenceFor(value: string): string {
  let fence = "```";
  while (value.includes(fence)) {
    fence += "`";
  }
  return fence;
}
