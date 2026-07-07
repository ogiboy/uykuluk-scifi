import { readFile } from "node:fs/promises";
import { z } from "zod";
import {
  finalReviewBundleCommand,
  finalReviewBundleJsonPath,
  finalReviewBundleMarkdownPath,
  finalReviewBundleSchema,
  isLegacyFinalReviewBundle,
  type FinalReviewBundle,
} from "../../../../src/stages/finalReviewBundleContracts";
import {
  finalReviewBundleDecisionStaleReason,
  finalReviewBundleDraftDigestStaleReason,
  finalReviewBundleReadyAction,
  finalReviewBundleRunIdStaleReason,
  finalReviewBundleStateStaleReason,
  type FinalReviewDecisionBinding,
} from "../../../../src/stages/finalReviewBundleValidation";
import type { EvidenceStatus } from "../../../../src/stages/statusMediaSummary";
import type { StudioRenderDecisionSummary } from "./renderDecisionSummaries";
import { studioRunFilePath } from "./runFilePaths";
import type { RunRecord } from "./runRecordTypes";

const draftRenderDigestSchema = z.looseObject({
  digest: z.string().regex(/^[a-f0-9]{64}$/),
  status: z.literal("pass"),
});

export type StudioFinalReviewBundleSummary =
  | { kind: "missing"; message: string; nextAction: string | null }
  | { kind: "invalid"; message: string; nextAction: string }
  | { kind: "stale"; message: string; nextAction: string }
  | {
      bundle: FinalReviewBundle;
      kind: "present";
      message: string;
      nextAction: string;
      reviewPath: string;
    };

/**
 * Reads the Studio-safe local final review bundle summary for a run.
 *
 * Studio trusts the bundle only when it still matches current run state, draft-render evidence,
 * and the current render decision projection. It never executes CLI transitions or upload paths.
 *
 * @param root - The project root containing local run artifacts.
 * @param record - The persisted run record.
 * @param evidence - The current validated evidence snapshot, when available.
 * @param renderDecision - The current Studio render-decision summary.
 * @returns A final review bundle summary for read-only operator surfaces.
 */
export async function readStudioFinalReviewBundleSummary(
  root: string,
  record: RunRecord,
  evidence: EvidenceStatus | null,
  renderDecision: StudioRenderDecisionSummary,
): Promise<StudioFinalReviewBundleSummary> {
  const runId = record.runId ?? "unknown";
  const target = studioRunFilePath(root, runId, finalReviewBundleJsonPath);
  if (!target) {
    return invalidBundle(runId, "Final review bundle path is invalid.");
  }

  try {
    const rawBundle = JSON.parse(await readFile(target, "utf8")) as unknown;
    if (isLegacyFinalReviewBundle(rawBundle)) {
      return staleBundle(runId, "Final review bundle uses legacy schema version 1; regenerate it.");
    }
    const bundle = finalReviewBundleSchema.parse(rawBundle);
    const staleReason = finalReviewBundleStaleReason(record, evidence, renderDecision, bundle);
    if (staleReason) {
      return staleBundle(runId, staleReason);
    }
    return {
      bundle,
      kind: "present",
      message: `Final review bundle ready: ${bundle.status}.`,
      nextAction: finalReviewBundleReadyAction(bundle),
      reviewPath: finalReviewBundleMarkdownPath,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return missingBundle(record);
    }
    return invalidBundle(
      runId,
      `Final review bundle could not be trusted: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function finalReviewBundleStaleReason(
  record: RunRecord,
  evidence: EvidenceStatus | null,
  renderDecision: StudioRenderDecisionSummary,
  bundle: FinalReviewBundle,
): string | null {
  const runMismatch = finalReviewBundleRunIdStaleReason(bundle.runId, record.runId ?? "unknown");
  if (runMismatch) return runMismatch;
  const stateMismatch = finalReviewBundleStateStaleReason(record.state);
  if (stateMismatch) return stateMismatch;
  const draftRender = draftRenderDigestSchema.safeParse(evidence?.draftRender);
  const currentDigest = draftRender.success ? draftRender.data.digest : null;
  const digestMismatch = finalReviewBundleDraftDigestStaleReason(bundle, currentDigest);
  if (digestMismatch) return digestMismatch;
  return finalReviewBundleDecisionStaleReason(
    bundle,
    studioFinalReviewDecisionBinding(renderDecision),
  );
}

function missingBundle(
  record: RunRecord,
): Extract<StudioFinalReviewBundleSummary, { kind: "missing" }> {
  const nextAction =
    record.state === "RENDERED" && record.runId ? finalReviewBundleCommand(record.runId) : null;
  if (record.artifacts?.includes(finalReviewBundleJsonPath)) {
    return {
      kind: "missing",
      message: "Final review bundle is listed in run artifacts but the JSON file is missing.",
      nextAction,
    };
  }
  return { kind: "missing", message: "Final review bundle has not been generated.", nextAction };
}

function invalidBundle(
  runId: string,
  message: string,
): Extract<StudioFinalReviewBundleSummary, { kind: "invalid" }> {
  return { kind: "invalid", message, nextAction: finalReviewBundleCommand(runId) };
}

function staleBundle(
  runId: string,
  message: string,
): Extract<StudioFinalReviewBundleSummary, { kind: "stale" }> {
  return { kind: "stale", message, nextAction: finalReviewBundleCommand(runId) };
}

function studioFinalReviewDecisionBinding(
  renderDecision: StudioRenderDecisionSummary,
): FinalReviewDecisionBinding {
  if (renderDecision.kind !== "present") {
    return { kind: renderDecision.kind };
  }
  return {
    createdAt: renderDecision.decision.createdAt,
    decision: renderDecision.decision.decision,
    kind: "present",
  };
}
