import { readFile } from "node:fs/promises";
import { channelHandoffJsonPath } from "../../../../src/stages/channelHandoffContracts";
import {
  channelHandoffDecisionCommand,
  channelHandoffDecisionJsonPath,
  channelHandoffDecisionMarkdownPath,
  channelHandoffDecisionRecordSchema,
  type ChannelHandoffDecisionRecord,
} from "../../../../src/stages/channelHandoffDecisionContracts";
import { sha256 } from "../../../../src/utils/hash";
import type { StudioChannelHandoffSummary } from "./channelHandoffSummaries";
import { studioRunFilePath } from "./runFilePaths";
import type { RunRecord } from "./runRecordTypes";

export type StudioChannelHandoffDecisionSummary =
  | { kind: "missing"; message: string; nextAction: string | null }
  | { kind: "invalid"; message: string; nextAction: string }
  | { kind: "stale"; message: string; nextAction: string }
  | {
      decision: ChannelHandoffDecisionRecord;
      kind: "present";
      message: string;
      nextAction: string;
      reviewPath: string;
    };

/**
 * Reads the Studio-safe manual channel-handoff decision summary for a run.
 *
 * The Studio only trusts a decision when it still matches the current trusted channel-handoff
 * package. It never uploads media or grants upload/publish approval.
 *
 * @param root - The project root containing local run artifacts.
 * @param record - The persisted run record.
 * @param channelHandoff - The trusted manual channel-handoff summary for the same run.
 * @returns A channel-handoff decision summary for read-only operator surfaces.
 */
export async function readStudioChannelHandoffDecisionSummary(
  root: string,
  record: RunRecord,
  channelHandoff: StudioChannelHandoffSummary,
): Promise<StudioChannelHandoffDecisionSummary> {
  const runId = record.runId ?? "unknown";
  const nextAction =
    channelHandoff.kind === "present" && record.runId
      ? channelHandoffDecisionCommand(record.runId)
      : null;
  const target = studioRunFilePath(root, runId, channelHandoffDecisionJsonPath);
  if (!target) {
    return invalidDecision(runId, "Manual channel-handoff decision path is invalid.");
  }
  try {
    const decision = channelHandoffDecisionRecordSchema.parse(
      JSON.parse(await readFile(target, "utf8")) as unknown,
    );
    const staleReason = await channelHandoffDecisionStaleReason(
      root,
      record,
      channelHandoff,
      decision,
    );
    if (staleReason) {
      return staleDecision(runId, staleReason, nextAction ?? channelHandoff.nextAction);
    }
    return {
      decision,
      kind: "present",
      message: `Channel handoff decision recorded: ${decision.decision}.`,
      nextAction: decision.nextSafeAction,
      reviewPath: channelHandoffDecisionMarkdownPath,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return missingDecision(record, nextAction);
    }
    return invalidDecision(
      runId,
      `Manual channel-handoff decision could not be trusted: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

async function channelHandoffDecisionStaleReason(
  root: string,
  record: RunRecord,
  channelHandoff: StudioChannelHandoffSummary,
  decision: ChannelHandoffDecisionRecord,
): Promise<string | null> {
  const runId = record.runId ?? "unknown";
  if (decision.runId !== runId) {
    return "Manual channel-handoff decision belongs to a different run.";
  }
  if (channelHandoff.kind !== "present") {
    return `Manual channel-handoff decision depends on ${channelHandoff.kind} channel handoff evidence.`;
  }
  const handoffFile = studioRunFilePath(root, runId, channelHandoffJsonPath);
  if (!handoffFile) {
    return "Manual channel-handoff path is invalid.";
  }
  const handoffDigest = sha256(await readFile(handoffFile, "utf8"));
  if (decision.channelHandoff.digest !== handoffDigest) {
    return "Manual channel-handoff decision was recorded for a different handoff digest.";
  }
  if (decision.channelHandoff.status !== channelHandoff.handoff.status) {
    return "Manual channel-handoff decision was recorded for a different handoff status.";
  }
  return null;
}

function missingDecision(
  record: RunRecord,
  nextAction: string | null,
): Extract<StudioChannelHandoffDecisionSummary, { kind: "missing" }> {
  if (record.artifacts?.includes(channelHandoffDecisionJsonPath)) {
    return {
      kind: "missing",
      message:
        "Manual channel-handoff decision is listed in run artifacts but the JSON file is missing.",
      nextAction,
    };
  }
  return {
    kind: "missing",
    message: "Manual channel-handoff decision has not been recorded.",
    nextAction,
  };
}

function invalidDecision(
  runId: string,
  message: string,
): Extract<StudioChannelHandoffDecisionSummary, { kind: "invalid" }> {
  return { kind: "invalid", message, nextAction: channelHandoffDecisionCommand(runId) };
}

function staleDecision(
  runId: string,
  message: string,
  nextAction: string | null,
): Extract<StudioChannelHandoffDecisionSummary, { kind: "stale" }> {
  return { kind: "stale", message, nextAction: nextAction ?? channelHandoffDecisionCommand(runId) };
}
