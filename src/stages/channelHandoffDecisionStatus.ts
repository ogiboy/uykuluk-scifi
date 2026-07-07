import { readFile } from "node:fs/promises";
import { artifactPath } from "../core/artifacts.js";
import type { RunRecord } from "../core/state.js";
import { sha256 } from "../utils/hash.js";
import { channelHandoffJsonPath } from "./channelHandoffContracts.js";
import {
  channelHandoffDecisionCommand,
  channelHandoffDecisionJsonPath,
  channelHandoffDecisionRecordSchema,
  type ChannelHandoffDecisionRecord,
} from "./channelHandoffDecisionContracts.js";
import type { ChannelHandoffStatus } from "./channelHandoffStatus.js";

export type ChannelHandoffDecisionStatus =
  | { kind: "missing"; nextAction: string | null }
  | { kind: "invalid"; message: string; nextAction: string }
  | { kind: "stale"; message: string; nextAction: string }
  | {
      decision: ChannelHandoffDecisionRecord;
      kind: "present";
      message: string;
      nextAction: string;
      reviewPath: string;
    };

export async function readChannelHandoffDecisionStatus(
  run: RunRecord,
  channelHandoff: ChannelHandoffStatus,
): Promise<ChannelHandoffDecisionStatus> {
  const nextAction =
    channelHandoff.kind === "present" ? channelHandoffDecisionCommand(run.runId) : null;
  try {
    const decision = channelHandoffDecisionRecordSchema.parse(
      JSON.parse(await readFile(artifactPath(run.runId, channelHandoffDecisionJsonPath), "utf8")),
    );
    const staleReason = await channelHandoffDecisionStaleReason(run, channelHandoff, decision);
    if (staleReason) {
      return {
        kind: "stale",
        message: staleReason,
        nextAction: nextAction ?? decision.nextSafeAction,
      };
    }
    return {
      decision,
      kind: "present",
      message: `Channel handoff decision recorded: ${decision.decision}.`,
      nextAction: decision.nextSafeAction,
      reviewPath: "production/channel_handoff_decision.md",
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { kind: "missing", nextAction };
    }
    return {
      kind: "invalid",
      message: `Channel handoff decision could not be trusted: ${
        error instanceof Error ? error.message : String(error)
      }`,
      nextAction: nextAction ?? "Regenerate trusted channel handoff evidence.",
    };
  }
}

async function channelHandoffDecisionStaleReason(
  run: RunRecord,
  channelHandoff: ChannelHandoffStatus,
  decision: ChannelHandoffDecisionRecord,
): Promise<string | null> {
  if (decision.runId !== run.runId) {
    return "Channel handoff decision belongs to a different run.";
  }
  if (channelHandoff.kind !== "present") {
    return `Channel handoff decision depends on ${channelHandoff.kind} channel handoff evidence.`;
  }
  const currentHandoffDigest = sha256(
    await readFile(artifactPath(run.runId, channelHandoffJsonPath), "utf8"),
  );
  if (decision.channelHandoff.digest !== currentHandoffDigest) {
    return "Channel handoff decision was recorded for a different channel handoff digest.";
  }
  if (decision.channelHandoff.status !== channelHandoff.handoff.status) {
    return "Channel handoff decision was recorded for a different channel handoff status.";
  }
  return null;
}
