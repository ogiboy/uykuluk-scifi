import { readFile } from "node:fs/promises";
import { z } from "zod";
import {
  finalReviewBundleCommand,
  finalReviewBundleJsonPath,
  finalReviewBundleMarkdownPath,
  finalReviewBundleSchema,
  type FinalReviewBundle,
} from "../../../../src/stages/finalReviewBundleContracts";
import type { EvidenceStatus } from "../../../../src/stages/statusMediaSummary";
import { studioRunFilePath } from "./runFilePaths";
import type { StudioRenderDecisionSummary } from "./renderDecisionSummaries";
import type { RunRecord } from "./runSummaries";

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
    const bundle = finalReviewBundleSchema.parse(JSON.parse(await readFile(target, "utf8")));
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
  if (bundle.runId !== record.runId) {
    return "Final review bundle belongs to a different run.";
  }
  if (record.state !== "RENDERED") {
    return `Final review bundle was created, but the run is ${record.state ?? "unknown"}.`;
  }
  const draftRender = draftRenderDigestSchema.safeParse(evidence?.draftRender);
  if (!draftRender.success || bundle.draftRender.sha256 !== draftRender.data.digest) {
    return "Final review bundle was created for a different draft render digest.";
  }
  return renderDecisionBundleMismatch(renderDecision, bundle);
}

function renderDecisionBundleMismatch(
  renderDecision: StudioRenderDecisionSummary,
  bundle: FinalReviewBundle,
): string | null {
  if (renderDecision.kind === "present") {
    if (bundle.renderDecision.kind !== "present") {
      return "Final review bundle is missing the recorded render decision.";
    }
    if (bundle.renderDecision.createdAt !== renderDecision.decision.createdAt) {
      return "Final review bundle was created for a different render decision.";
    }
    if (bundle.renderDecision.decision !== renderDecision.decision.decision) {
      return "Final review bundle was created for a different render decision outcome.";
    }
    return null;
  }
  if (bundle.renderDecision.kind === "present") {
    return "Final review bundle includes a render decision that is no longer trusted.";
  }
  if (renderDecision.kind === "invalid" || renderDecision.kind === "stale") {
    return `Final review bundle depends on ${renderDecision.kind} render decision evidence.`;
  }
  return null;
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
  return {
    kind: "missing",
    message: "Final review bundle has not been generated.",
    nextAction,
  };
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

function finalReviewBundleReadyAction(bundle: FinalReviewBundle): string {
  if (bundle.status === "accepted-for-local-review") {
    return `Local final review handoff is ready at ${finalReviewBundleMarkdownPath}. Upload remains disabled until a future private-upload approval/config path exists.`;
  }
  return bundle.nextSafeAction;
}
