import { readFile } from "node:fs/promises";
import {
  buildChannelHandoffPayload,
  channelHandoffCommand,
  channelHandoffJsonPath,
  channelHandoffMarkdownPath,
  channelHandoffSchema,
  comparableChannelHandoffPayload,
  type ChannelHandoff,
  youtubeMetadataSchema,
} from "../../../../src/stages/channelHandoffContracts";
import { sha256 } from "../../../../src/utils/hash";
import type { StudioFinalReviewBundleSummary } from "./finalReviewBundleSummaries";
import { studioRunFilePath } from "./runFilePaths";
import type { RunRecord } from "./runRecordTypes";

const finalReviewBundleJsonPath = "production/review_bundle.json";

export type StudioChannelHandoffSummary =
  | { kind: "missing"; message: string; nextAction: string | null }
  | { kind: "invalid"; message: string; nextAction: string }
  | { kind: "stale"; message: string; nextAction: string }
  | {
      handoff: ChannelHandoff;
      kind: "present";
      message: string;
      nextAction: string;
      reviewPath: string;
    };

/**
 * Reads the Studio-safe manual channel handoff summary for a run.
 *
 * Studio trusts the handoff only when it still matches the accepted final-review digest. It never
 * uploads media or grants upload/publish approval.
 *
 * @param root - The project root containing local run artifacts.
 * @param record - The persisted run record.
 * @param finalReviewBundle - The trusted final-review bundle summary for the same run.
 * @returns A manual channel-handoff summary for read-only operator surfaces.
 */
export async function readStudioChannelHandoffSummary(
  root: string,
  record: RunRecord,
  finalReviewBundle: StudioFinalReviewBundleSummary,
): Promise<StudioChannelHandoffSummary> {
  const runId = record.runId ?? "unknown";
  const target = studioRunFilePath(root, runId, channelHandoffJsonPath);
  if (!target) {
    return invalidHandoff(runId, "Manual channel handoff path is invalid.");
  }
  try {
    const handoff = channelHandoffSchema.parse(JSON.parse(await readFile(target, "utf8")));
    const staleReason = await channelHandoffStaleReason(root, record, finalReviewBundle, handoff);
    if (staleReason) {
      return staleHandoff(runId, staleReason);
    }
    return {
      handoff,
      kind: "present",
      message: "Manual channel handoff package is ready for local operator review.",
      nextAction: handoff.nextSafeAction,
      reviewPath: channelHandoffMarkdownPath,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return missingHandoff(record, finalReviewBundle);
    }
    return invalidHandoff(
      runId,
      `Manual channel handoff could not be trusted: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

async function channelHandoffStaleReason(
  root: string,
  record: RunRecord,
  finalReviewBundle: StudioFinalReviewBundleSummary,
  handoff: ChannelHandoff,
): Promise<string | null> {
  const runId = record.runId ?? "unknown";
  if (handoff.runId !== runId) {
    return "Manual channel handoff belongs to a different run.";
  }
  if (record.state !== "RENDERED") {
    return `Manual channel handoff was created, but the run is ${record.state ?? "unknown"}.`;
  }
  if (finalReviewBundle.kind !== "present") {
    return `Manual channel handoff depends on ${finalReviewBundle.kind} final review evidence.`;
  }
  if (finalReviewBundle.bundle.status !== "accepted-for-local-review") {
    return "Manual channel handoff requires an accepted local final review bundle.";
  }
  const finalReviewFile = studioRunFilePath(root, runId, finalReviewBundleJsonPath);
  if (!finalReviewFile) {
    return "Manual channel handoff final review path is invalid.";
  }
  const currentFinalReviewDigest = sha256(await readFile(finalReviewFile, "utf8"));
  if (handoff.finalReviewBundle.digest !== currentFinalReviewDigest) {
    return "Manual channel handoff was created for a different final review bundle digest.";
  }
  const metadataFile = studioRunFilePath(root, runId, "production/youtube_metadata.json");
  if (!metadataFile) {
    return "Manual channel handoff metadata path is invalid.";
  }
  const youtube = youtubeMetadataSchema.parse(JSON.parse(await readFile(metadataFile, "utf8")));
  const expected = buildChannelHandoffPayload({
    finalReviewBundle: finalReviewBundle.bundle,
    finalReviewBundleDigest: currentFinalReviewDigest,
    runId,
    youtube,
  });
  return JSON.stringify(comparableChannelHandoffPayload(handoff)) === JSON.stringify(expected)
    ? null
    : "Manual channel handoff no longer matches current final review or metadata inputs.";
}

function missingHandoff(
  record: RunRecord,
  finalReviewBundle: StudioFinalReviewBundleSummary,
): Extract<StudioChannelHandoffSummary, { kind: "missing" }> {
  const nextAction =
    finalReviewBundle.kind === "present" &&
    finalReviewBundle.bundle.status === "accepted-for-local-review" &&
    record.runId
      ? `pnpm producer channel-handoff --run ${record.runId}`
      : null;
  if (record.artifacts?.includes(channelHandoffJsonPath)) {
    return {
      kind: "missing",
      message: "Manual channel handoff is listed in run artifacts but the JSON file is missing.",
      nextAction,
    };
  }
  return {
    kind: "missing",
    message: "Manual channel handoff has not been generated.",
    nextAction,
  };
}

function invalidHandoff(
  runId: string,
  message: string,
): Extract<StudioChannelHandoffSummary, { kind: "invalid" }> {
  return { kind: "invalid", message, nextAction: channelHandoffCommand(runId) };
}

function staleHandoff(
  runId: string,
  message: string,
): Extract<StudioChannelHandoffSummary, { kind: "stale" }> {
  return { kind: "stale", message, nextAction: channelHandoffCommand(runId) };
}
