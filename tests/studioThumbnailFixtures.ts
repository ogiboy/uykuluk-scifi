import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
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
  const templatePath = "assets/thumbnails/thumbnail_template_01_left_1280x720.jpg";
  const overlayPath = "assets/thumbnails/thumbnail_text_safe_overlay_01_left_1280x720.png";
  const templateDigest = await ensureAssetDigest(templatePath, "thumbnail template");
  const overlayDigest = await ensureAssetDigest(overlayPath, "thumbnail overlay");
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
          digest: templateDigest,
          path: templatePath,
          role: "thumbnail-template",
        },
        textSafeOverlay: {
          digest: overlayDigest,
          path: overlayPath,
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

async function ensureAssetDigest(relativePath: string, content: string): Promise<string> {
  await mkdir(path.dirname(relativePath), { recursive: true });
  await writeFile(relativePath, content, "utf8");
  const bytes = await readFile(relativePath);
  return createHash("sha256").update(bytes).digest("hex");
}
