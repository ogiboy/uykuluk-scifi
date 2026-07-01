import { readFile } from "node:fs/promises";
import { z } from "zod";
import { sha256 } from "../../../../src/utils/hash";
import type { StudioFinalReviewBundleSummary } from "./finalReviewBundleSummaries";
import { studioRunFilePath } from "./runFilePaths";
import type { RunRecord } from "./runSummaries";

const channelHandoffJsonPath = "production/channel_handoff.json";
const channelHandoffMarkdownPath = "production/channel_handoff.md";
const finalReviewBundleJsonPath = "production/review_bundle.json";

const channelHandoffSchema = z.strictObject({
  schemaVersion: z.literal(1),
  runId: z.string().min(1),
  createdAt: z.string().min(1),
  status: z.literal("ready-for-manual-channel-review"),
  manualOnly: z.literal(true),
  finalReviewBundle: z.strictObject({
    path: z.literal(finalReviewBundleJsonPath),
    markdownPath: z.literal("production/review_bundle.md"),
    digest: z.string().regex(/^[a-f0-9]{64}$/),
    status: z.literal("accepted-for-local-review"),
  }),
  media: z.strictObject({
    draftRenderPath: z.string().min(1),
    draftRenderSha256: z.string().regex(/^[a-f0-9]{64}$/),
    durationSeconds: z.number().positive(),
    subtitlesPath: z.literal("production/subtitles.srt"),
    renderReviewPath: z.string().min(1),
  }),
  youtube: z.strictObject({
    metadataPath: z.literal("production/youtube_metadata.json"),
    title: z.string().min(1),
    description: z.string().min(1),
    tags: z.array(z.string().min(1)),
  }),
  operatorChecklist: z.array(z.string().min(1)).min(1),
  blockedActions: z.array(z.string().min(1)).min(1),
  nextSafeAction: z.string().min(1),
});

type StudioChannelHandoff = z.infer<typeof channelHandoffSchema>;

export type StudioChannelHandoffSummary =
  | { kind: "missing"; message: string; nextAction: string | null }
  | { kind: "invalid"; message: string; nextAction: string }
  | { kind: "stale"; message: string; nextAction: string }
  | {
      handoff: StudioChannelHandoff;
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
  handoff: StudioChannelHandoff,
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
  return handoff.finalReviewBundle.digest === currentFinalReviewDigest
    ? null
    : "Manual channel handoff was created for a different final review bundle digest.";
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
  return { kind: "invalid", message, nextAction: `pnpm producer channel-handoff --run ${runId}` };
}

function staleHandoff(
  runId: string,
  message: string,
): Extract<StudioChannelHandoffSummary, { kind: "stale" }> {
  return { kind: "stale", message, nextAction: `pnpm producer channel-handoff --run ${runId}` };
}
