import { readFile } from "node:fs/promises";
import { z } from "zod";
import { artifactPath, writeRunJson, writeRunText } from "../core/artifacts.js";
import { SafeExitError } from "../core/errors.js";
import { loadRun, saveRun } from "../core/runStore.js";
import { sha256 } from "../utils/hash.js";
import { readJsonFile } from "../utils/json.js";
import { nowIso } from "../utils/time.js";
import {
  channelHandoffJsonPath,
  channelHandoffMarkdownPath,
  channelHandoffSchema,
  type ChannelHandoff,
} from "./channelHandoffContracts.js";
import {
  finalReviewBundleJsonPath,
  finalReviewBundleMarkdownPath,
} from "./finalReviewBundleContracts.js";
import { readFinalReviewBundleStatus } from "./finalReviewBundleStatus.js";
import { renderChannelHandoffMarkdown } from "./channelHandoffMarkdown.js";
import { verifyProductionPackage } from "./productionPackageIntegrity.js";

const youtubeMetadataSchema = z.strictObject({
  title: z.string().min(1),
  description: z.string().min(1),
  tags: z.array(z.string().min(1)),
});

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
  const handoff = channelHandoffSchema.parse({
    schemaVersion: 1,
    runId: run.runId,
    createdAt: nowIso(),
    status: "ready-for-manual-channel-review",
    manualOnly: true,
    finalReviewBundle: {
      path: finalReviewBundleJsonPath,
      markdownPath: finalReviewBundleMarkdownPath,
      digest: sha256(finalReviewText),
      status: finalReview.bundle.status,
    },
    media: {
      draftRenderPath: finalReview.bundle.draftRender.path,
      draftRenderSha256: finalReview.bundle.draftRender.sha256,
      durationSeconds: finalReview.bundle.draftRender.durationSeconds,
      subtitlesPath: "production/subtitles.srt",
      renderReviewPath: finalReview.bundle.draftRender.reviewPath,
    },
    youtube: {
      metadataPath: "production/youtube_metadata.json",
      title: youtube.title,
      description: youtube.description,
      tags: youtube.tags,
    },
    operatorChecklist: operatorChecklist(),
    blockedActions: blockedActions(finalReview.bundle.blockedActions),
    nextSafeAction:
      "Manually review production/channel_handoff.md, the MP4, subtitles, metadata, and thumbnail assets before any future private-upload approval path is used.",
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

function operatorChecklist(): string[] {
  return [
    "Watch the draft MP4 from start to finish outside the app.",
    "Verify subtitles, voiceover timing, popup cards, and visual rhythm against the final review bundle.",
    "Review the YouTube title, description, and tags for channel tone, accuracy, and policy risk.",
    "Choose or revise the thumbnail manually from tracked brand assets before any upload workflow.",
    "Keep upload and public/scheduled publish disabled unless a future explicit approval/config path exists.",
  ];
}

function blockedActions(finalReviewBlockedActions: readonly string[]): string[] {
  return Array.from(
    new Set([
      ...finalReviewBlockedActions,
      "This handoff does not call YouTube APIs or create a private upload.",
      "This handoff does not approve public or scheduled publishing.",
    ]),
  );
}
