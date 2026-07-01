import { readFile } from "node:fs/promises";
import { artifactPath } from "../core/artifacts.js";
import type { RunRecord } from "../core/state.js";
import { sha256 } from "../utils/hash.js";
import { readJsonFile } from "../utils/json.js";
import {
  channelHandoffCommand,
  channelHandoffJsonPath,
  channelHandoffMarkdownPath,
  channelHandoffSchema,
  type ChannelHandoff,
} from "./channelHandoffContracts.js";
import { finalReviewBundleJsonPath } from "./finalReviewBundleContracts.js";
import type { FinalReviewBundleStatus } from "./finalReviewBundleStatus.js";

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
      : null;
  try {
    const handoff = channelHandoffSchema.parse(
      await readJsonFile<unknown>(artifactPath(run.runId, channelHandoffJsonPath)),
    );
    const staleReason = await channelHandoffStaleReason(run, finalReviewBundle, handoff);
    if (staleReason) {
      return stale(staleReason, run.runId);
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
      nextAction: channelHandoffCommand(run.runId),
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
  return handoff.finalReviewBundle.digest === sha256(finalReviewJson)
    ? null
    : "Manual channel handoff was created for a different final review bundle digest.";
}

function stale(message: string, runId: string): ChannelHandoffStatus {
  return {
    kind: "stale",
    message,
    nextAction: channelHandoffCommand(runId),
  };
}
