import { readFile } from "node:fs/promises";
import { artifactPath, writeRunJson, writeRunText } from "../core/artifacts.js";
import { SafeExitError } from "../core/errors.js";
import { loadRun, saveRun } from "../core/runStore.js";
import { sha256 } from "../utils/hash.js";
import { readJsonFile } from "../utils/json.js";
import { nowIso } from "../utils/time.js";
import {
  buildChannelHandoffPayload,
  type ChannelHandoff,
  channelHandoffJsonPath,
  channelHandoffMarkdownPath,
  channelHandoffSchema,
  youtubeMetadataSchema,
} from "./channelHandoffContracts.js";
import { renderChannelHandoffMarkdown } from "./channelHandoffMarkdown.js";
import { finalReviewBundleJsonPath } from "./finalReviewBundleContracts.js";
import { readFinalReviewBundleStatus } from "./finalReviewBundleStatus.js";
import { verifyProductionPackage } from "./productionPackageIntegrity.js";
import {
  buildThumbnailCandidatePack,
  renderThumbnailCandidateMarkdown,
  thumbnailCandidatesJsonPath,
  thumbnailCandidatesMarkdownPath,
} from "./thumbnailCandidates.js";

export {
  channelHandoffJsonPath,
  channelHandoffMarkdownPath,
  channelHandoffSchema,
  type ChannelHandoff,
} from "./channelHandoffContracts.js";
export { renderChannelHandoffMarkdown } from "./channelHandoffMarkdown.js";

/**
 * Creates a local manual channel handoff package from an accepted final review bundle.
 *
 * This command prepares local files and checklist text only. It never uploads, schedules, publishes,
 * changes run state, or grants upload/publish approval.
 *
 * @param runId - The rendered run whose accepted final review should be packaged for manual review.
 * @returns The persisted channel handoff package.
 */
export async function createChannelHandoff(runId: string): Promise<ChannelHandoff> {
  let run = await loadRun(runId);
  const finalReview = await readFinalReviewBundleStatus(run);
  if (finalReview.kind !== "present") {
    throw new SafeExitError("Channel handoff requires a trusted final review bundle.");
  }
  if (finalReview.bundle.status !== "accepted-for-local-review") {
    throw new SafeExitError("Channel handoff requires an accepted local final review decision.");
  }
  await verifyProductionPackage(run);
  const finalReviewText = await readFile(
    artifactPath(run.runId, finalReviewBundleJsonPath),
    "utf8",
  );
  const youtube = youtubeMetadataSchema.parse(
    await readJsonFile<unknown>(artifactPath(run.runId, "production/youtube_metadata.json")),
  );
  const thumbnailCandidates = await buildThumbnailCandidatePack({
    finalReviewBundleDigest: sha256(finalReviewText),
    runId: run.runId,
  });
  run = await writeRunJson(
    run,
    "channel-handoff",
    thumbnailCandidatesJsonPath,
    thumbnailCandidates,
  );
  run = await writeRunText(
    run,
    "channel-handoff",
    thumbnailCandidatesMarkdownPath,
    renderThumbnailCandidateMarkdown(thumbnailCandidates),
  );
  const thumbnailJson = await readFile(
    artifactPath(run.runId, thumbnailCandidatesJsonPath),
    "utf8",
  );
  const thumbnailMarkdown = await readFile(
    artifactPath(run.runId, thumbnailCandidatesMarkdownPath),
    "utf8",
  );
  const handoff = channelHandoffSchema.parse({
    createdAt: nowIso(),
    ...buildChannelHandoffPayload({
      finalReviewBundle: finalReview.bundle,
      finalReviewBundleDigest: sha256(finalReviewText),
      runId: run.runId,
      thumbnailCandidates: {
        jsonPath: thumbnailCandidatesJsonPath,
        markdownPath: thumbnailCandidatesMarkdownPath,
        jsonSha256: sha256(thumbnailJson),
        markdownSha256: sha256(thumbnailMarkdown),
        recommendedCandidateId: thumbnailCandidates.recommendedCandidateId,
      },
      youtube,
    }),
  });
  run = await writeRunJson(run, "channel-handoff", channelHandoffJsonPath, handoff);
  run = await writeRunText(
    run,
    "channel-handoff",
    channelHandoffMarkdownPath,
    renderChannelHandoffMarkdown(handoff),
  );
  await saveRun(run);
  return handoff;
}
