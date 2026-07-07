import { readFile, writeFile } from "node:fs/promises";
import { artifactPath } from "../src/core/artifacts";
import { loadRun, saveRun } from "../src/core/runStore";
import {
  buildChannelHandoffPayload,
  channelHandoffJsonPath,
  channelHandoffMarkdownPath,
  channelHandoffSchema,
  type ChannelHandoff,
} from "../src/stages/channelHandoffContracts";
import {
  channelHandoffDecisionJsonPath,
  channelHandoffDecisionMarkdownPath,
  renderChannelHandoffDecisionMarkdown,
  type ChannelHandoffDecisionRecord,
} from "../src/stages/channelHandoffDecision";
import { renderChannelHandoffMarkdown } from "../src/stages/channelHandoffMarkdown";
import { finalReviewBundleJsonPath } from "../src/stages/finalReviewBundleContracts";
import {
  thumbnailCandidatesJsonPath,
  thumbnailCandidatesMarkdownPath,
} from "../src/stages/thumbnailCandidates";
import { sha256 } from "../src/utils/hash";
import { writeStudioFinalReviewBundle } from "./studioRenderDecisionFixtures";
import { writeStudioThumbnailCandidates } from "./studioThumbnailFixtures";

/**
 * Writes a Studio-valid manual channel handoff for a rendered fixture run.
 *
 * @param runId - The run identifier.
 * @returns The persisted manual channel handoff.
 */
export async function writeStudioChannelHandoff(runId: string): Promise<ChannelHandoff> {
  const finalReviewBundle = await writeStudioFinalReviewBundle(runId, "accepted-for-local-review");
  const finalReviewJson = await readFixtureText(runId, finalReviewBundleJsonPath);
  const run = await loadRun(runId);
  const youtube = {
    description: "Fixture description.",
    tags: ["uykuluk", "scifi"],
    title: "Fixture title",
  };
  await writeFile(
    artifactPath(runId, "production/youtube_metadata.json"),
    JSON.stringify(youtube),
    "utf8",
  );
  const thumbnailCandidates = await writeStudioThumbnailCandidates(runId, sha256(finalReviewJson));
  const handoff = channelHandoffSchema.parse({
    createdAt: "2026-06-28T00:10:00.000Z",
    ...buildChannelHandoffPayload({
      finalReviewBundle,
      finalReviewBundleDigest: sha256(finalReviewJson),
      runId,
      thumbnailCandidates,
      youtube,
    }),
  });
  await writeFile(artifactPath(runId, channelHandoffJsonPath), JSON.stringify(handoff), "utf8");
  await writeFile(
    artifactPath(runId, channelHandoffMarkdownPath),
    renderChannelHandoffMarkdown(handoff),
    "utf8",
  );
  await saveRun({
    ...run,
    artifacts: Array.from(
      new Set(
        run.artifacts.concat(
          thumbnailCandidatesJsonPath,
          thumbnailCandidatesMarkdownPath,
          channelHandoffJsonPath,
          channelHandoffMarkdownPath,
        ),
      ),
    ),
  });
  return handoff;
}

/**
 * Writes a Studio-valid manual channel-handoff decision for a rendered fixture run.
 *
 * @param runId - The run identifier.
 * @returns The persisted manual channel-handoff decision.
 */
export async function writeStudioChannelHandoffDecision(
  runId: string,
): Promise<ChannelHandoffDecisionRecord> {
  await writeStudioChannelHandoff(runId);
  const run = await loadRun(runId);
  const handoffJson = await readFixtureText(runId, channelHandoffJsonPath);
  const record: ChannelHandoffDecisionRecord = {
    blockedActions: [
      "This decision does not call YouTube APIs or create a private upload.",
      "This decision does not approve public or scheduled publishing.",
    ],
    channelHandoff: {
      digest: sha256(handoffJson),
      path: channelHandoffJsonPath,
      status: "ready-for-manual-channel-review",
    },
    createdAt: "2026-06-28T00:15:00.000Z",
    decision: "accepted-for-manual-channel-prep",
    manualOnly: true,
    nextSafeAction: "Private upload remains disabled.",
    notes: "Fixture channel handoff accepted for manual preparation.",
    reviewedBy: "operator",
    runId,
    schemaVersion: 1,
    selectedThumbnailCandidate: {
      candidateId: "thumbnail-01-left",
      templatePath: "assets/thumbnails/thumbnail_template_01_left_1280x720.jpg",
      templateSha256: "e".repeat(64),
      textSafeOverlayPath: "assets/thumbnails/thumbnail_text_safe_overlay_01_left_1280x720.png",
      textSafeOverlaySha256: "f".repeat(64),
    },
    youtube: { metadataPath: "production/youtube_metadata.json", title: "Fixture title" },
  };
  await writeFile(
    artifactPath(runId, channelHandoffDecisionJsonPath),
    JSON.stringify(record),
    "utf8",
  );
  await writeFile(
    artifactPath(runId, channelHandoffDecisionMarkdownPath),
    renderChannelHandoffDecisionMarkdown(record),
    "utf8",
  );
  await saveRun({
    ...run,
    artifacts: Array.from(
      new Set(
        run.artifacts.concat(channelHandoffDecisionJsonPath, channelHandoffDecisionMarkdownPath),
      ),
    ),
  });
  return record;
}

async function readFixtureText(runId: string, relativePath: string): Promise<string> {
  return readFile(artifactPath(runId, relativePath), "utf8");
}
