import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { artifactPath } from "../src/core/artifacts";
import type { ChannelHandoff } from "../src/stages/channelHandoffContracts";
import {
  buildThumbnailCandidatePack,
  renderThumbnailCandidateMarkdown,
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
  await ensureStudioThumbnailAssets();
  const pack = await buildThumbnailCandidatePack({ finalReviewBundleDigest, runId });
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

async function ensureStudioThumbnailAssets(): Promise<void> {
  const thumbnailDir = path.join(process.cwd(), "assets/thumbnails");
  await mkdir(thumbnailDir, { recursive: true });
  await writeFile(
    path.join(thumbnailDir, "thumbnail_template_01_left_1280x720.jpg"),
    "studio fixture thumbnail template",
    "utf8",
  );
  await writeFile(
    path.join(thumbnailDir, "thumbnail_text_safe_overlay_01_left_1280x720.png"),
    "studio fixture thumbnail overlay",
    "utf8",
  );
}
