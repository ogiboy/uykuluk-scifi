import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { artifactPath } from "../core/artifacts.js";
import type { RunRecord } from "../core/state.js";
import { sha256 } from "../utils/hash.js";
import { readJsonFile } from "../utils/json.js";
import {
  buildChannelHandoffPayload,
  channelHandoffCommand,
  channelHandoffJsonPath,
  channelHandoffMarkdownPath,
  channelHandoffSchema,
  comparableChannelHandoffPayload,
  isLegacyChannelHandoff,
  type ChannelHandoff,
  youtubeMetadataSchema,
} from "./channelHandoffContracts.js";
import { finalReviewBundleJsonPath } from "./finalReviewBundleContracts.js";
import type { FinalReviewBundleStatus } from "./finalReviewBundleStatus.js";
import {
  thumbnailCandidatePackSchema,
  thumbnailCandidatesJsonPath,
  thumbnailCandidatesMarkdownPath,
} from "./thumbnailCandidates.js";

export type ChannelHandoffStatus =
  | { kind: "missing"; nextAction: string | null }
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
 * Reads and validates the manual channel handoff package for a run.
 *
 * A handoff is trusted only when it still matches the accepted final review bundle digest. It does
 * not approve upload or publish; it only marks the local manual-review package as ready.
 *
 * @param run - The run whose channel handoff should be inspected.
 * @param finalReviewBundle - The trusted final-review bundle status for the same run.
 * @returns The current manual channel-handoff status.
 */
export async function readChannelHandoffStatus(
  run: RunRecord,
  finalReviewBundle: FinalReviewBundleStatus,
): Promise<ChannelHandoffStatus> {
  const nextAction =
    finalReviewBundle.kind === "present" &&
    finalReviewBundle.bundle.status === "accepted-for-local-review"
      ? channelHandoffCommand(run.runId)
      : finalReviewBundle.nextAction;
  try {
    const rawHandoff = await readJsonFile<unknown>(artifactPath(run.runId, channelHandoffJsonPath));
    if (isLegacyChannelHandoff(rawHandoff)) {
      return stale(
        "Manual channel handoff uses legacy schema version 1; regenerate it.",
        run.runId,
        nextAction,
      );
    }
    const handoff = channelHandoffSchema.parse(rawHandoff);
    const staleReason = await channelHandoffStaleReason(run, finalReviewBundle, handoff);
    if (staleReason) {
      return stale(staleReason, run.runId, nextAction);
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
      return { kind: "missing", nextAction };
    }
    return {
      kind: "invalid",
      message: `Manual channel handoff could not be trusted: ${
        error instanceof Error ? error.message : String(error)
      }`,
      nextAction: nextAction ?? "Regenerate trusted final review evidence before channel handoff.",
    };
  }
}

async function channelHandoffStaleReason(
  run: RunRecord,
  finalReviewBundle: FinalReviewBundleStatus,
  handoff: ChannelHandoff,
): Promise<string | null> {
  if (handoff.runId !== run.runId) {
    return "Manual channel handoff belongs to a different run.";
  }
  if (run.state !== "RENDERED") {
    return `Manual channel handoff was created, but the run is ${run.state}.`;
  }
  if (finalReviewBundle.kind !== "present") {
    return `Manual channel handoff depends on ${finalReviewBundle.kind} final review evidence.`;
  }
  if (finalReviewBundle.bundle.status !== "accepted-for-local-review") {
    return "Manual channel handoff requires an accepted local final review bundle.";
  }
  if (handoff.finalReviewBundle.status !== finalReviewBundle.bundle.status) {
    return "Manual channel handoff was created for a different final review status.";
  }
  const finalReviewJson = await readFile(
    artifactPath(run.runId, finalReviewBundleJsonPath),
    "utf8",
  );
  const finalReviewBundleDigest = sha256(finalReviewJson);
  if (handoff.finalReviewBundle.digest !== finalReviewBundleDigest) {
    return "Manual channel handoff was created for a different final review bundle digest.";
  }
  const thumbnailCandidates = await trustedThumbnailCandidateBinding(
    run.runId,
    finalReviewBundleDigest,
  );
  if (thumbnailCandidates.kind === "stale") {
    return thumbnailCandidates.message;
  }
  const youtube = youtubeMetadataSchema.parse(
    await readJsonFile<unknown>(artifactPath(run.runId, "production/youtube_metadata.json")),
  );
  const expected = buildChannelHandoffPayload({
    finalReviewBundle: finalReviewBundle.bundle,
    finalReviewBundleDigest,
    runId: run.runId,
    thumbnailCandidates: thumbnailCandidates.binding,
    youtube,
  });
  return JSON.stringify(comparableChannelHandoffPayload(handoff)) === JSON.stringify(expected)
    ? null
    : "Manual channel handoff no longer matches current final review or metadata inputs.";
}

async function trustedThumbnailCandidateBinding(
  runId: string,
  finalReviewBundleDigest: string,
): Promise<
  | { binding: ChannelHandoff["thumbnailCandidates"]; kind: "present" }
  | { kind: "stale"; message: string }
> {
  const json = await readFile(artifactPath(runId, thumbnailCandidatesJsonPath), "utf8");
  const markdown = await readFile(artifactPath(runId, thumbnailCandidatesMarkdownPath), "utf8");
  const pack = thumbnailCandidatePackSchema.parse(JSON.parse(json) as unknown);
  if (pack.runId !== runId) {
    throw new Error("Thumbnail candidates belong to a different run.");
  }
  if (pack.source.finalReviewBundleDigest !== finalReviewBundleDigest) {
    return {
      kind: "stale",
      message: "Thumbnail candidates were created for a different final review bundle.",
    };
  }
  for (const candidate of pack.candidates) {
    const templateStale = await assetDigestMismatch(
      candidate.template.path,
      candidate.template.digest,
    );
    if (templateStale) {
      return { kind: "stale", message: templateStale };
    }
    if (candidate.textSafeOverlay) {
      const overlayStale = await assetDigestMismatch(
        candidate.textSafeOverlay.path,
        candidate.textSafeOverlay.digest,
      );
      if (overlayStale) {
        return { kind: "stale", message: overlayStale };
      }
    }
  }
  return {
    binding: {
      jsonPath: thumbnailCandidatesJsonPath,
      markdownPath: thumbnailCandidatesMarkdownPath,
      jsonSha256: sha256(json),
      markdownSha256: sha256(markdown),
      recommendedCandidateId: pack.recommendedCandidateId,
    },
    kind: "present",
  };
}

async function assetDigestMismatch(
  relativePath: string,
  expectedDigest: string,
): Promise<string | null> {
  let bytes;
  try {
    bytes = await readFile(path.join(process.cwd(), relativePath));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return `Thumbnail asset is missing: ${relativePath}`;
    }
    throw error;
  }
  const currentDigest = createHash("sha256").update(bytes).digest("hex");
  return currentDigest === expectedDigest
    ? null
    : `Thumbnail asset changed since handoff candidate generation: ${relativePath}`;
}

function stale(message: string, runId: string, nextAction: string | null): ChannelHandoffStatus {
  return {
    kind: "stale",
    message,
    nextAction: nextAction ?? `Regenerate trusted final review evidence for ${runId}.`,
  };
}
