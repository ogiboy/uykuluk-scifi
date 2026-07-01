import { bulletList, table } from "../utils/markdown.js";
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
      ],
    ),
    "",
    "## YouTube Metadata Draft",
    "",
    table(
      ["Field", "Value"],
      [
        ["Metadata JSON", handoff.youtube.metadataPath],
        ["Title", handoff.youtube.title],
        ["Tags", handoff.youtube.tags.join(", ")],
      ],
    ),
    "",
    "Description:",
    "",
    handoff.youtube.description,
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
