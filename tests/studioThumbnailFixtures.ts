import { writeFile } from "node:fs/promises";
import { artifactPath } from "../src/core/artifacts";
import type { ChannelHandoff } from "../src/stages/channelHandoffContracts";
import {
  renderThumbnailCandidateMarkdown,
  thumbnailCandidatePackSchema,
  thumbnailCandidatesJsonPath,
  thumbnailCandidatesMarkdownPath,
} from "../src/stages/thumbnailCandidates";
import { sha256 } from "../src/utils/hash";

/**
 * Writes Studio-valid thumbnail candidate artifacts for synthetic handoff fixtures.
 *
 * @param runId - The run identifier.
 * @param finalReviewBundleDigest - Digest of the bound final review bundle JSON.
 * @returns The channel-handoff thumbnail binding.
 */
export async function writeStudioThumbnailCandidates(
  runId: string,
  finalReviewBundleDigest: string,
): Promise<ChannelHandoff["thumbnailCandidates"]> {
  const pack = thumbnailCandidatePackSchema.parse({
    blockedActions: [
      "Thumbnail candidates do not approve private upload.",
      "Thumbnail candidates do not approve scheduled or public publishing.",
    ],
    candidates: [
      {
        id: "thumbnail-01-left",
        reviewFocus: "Check title-safe area, contrast, and channel tone.",
        template: {
          digest: "e".repeat(64),
          path: "assets/thumbnails/thumbnail_template_01_left_1280x720.jpg",
          role: "thumbnail-template",
        },
        textSafeOverlay: {
          digest: "f".repeat(64),
          path: "assets/thumbnails/thumbnail_text_safe_overlay_01_left_1280x720.png",
          role: "thumbnail-overlay",
        },
      },
    ],
    operatorNotes: ["Pick or revise one thumbnail manually before any future upload path."],
    recommendedCandidateId: "thumbnail-01-left",
    runId,
    schemaVersion: 1,
    source: {
      finalReviewBundleDigest,
      finalReviewBundlePath: "production/review_bundle.json",
    },
  });
  const json = JSON.stringify(pack);
  const markdown = renderThumbnailCandidateMarkdown(pack);
  await writeFile(artifactPath(runId, thumbnailCandidatesJsonPath), json, "utf8");
  await writeFile(artifactPath(runId, thumbnailCandidatesMarkdownPath), markdown, "utf8");
  return {
    jsonPath: thumbnailCandidatesJsonPath,
    jsonSha256: sha256(json),
    markdownPath: thumbnailCandidatesMarkdownPath,
    markdownSha256: sha256(markdown),
    recommendedCandidateId: pack.recommendedCandidateId,
  };
}
