import type { StudioChannelHandoffDecisionSummary } from "./channelHandoffDecisionSummaries";
import { readStudioChannelHandoffDecisionSummary } from "./channelHandoffDecisionSummaries";
import type { StudioChannelHandoffSummary } from "./channelHandoffSummaries";
import { readStudioChannelHandoffSummary } from "./channelHandoffSummaries";
import type { StudioEvidenceSummary } from "./evidenceSummaries";
import { readStudioEvidenceSummary } from "./evidenceSummaries";
import type { StudioFinalReviewBundleSummary } from "./finalReviewBundleSummaries";
import { readStudioFinalReviewBundleSummary } from "./finalReviewBundleSummaries";
import type { StudioReadinessSummary } from "./readinessSummaries";
import { readStudioReadinessSnapshot, summarizeReadinessSnapshot } from "./readinessSummaries";
import type { StudioRenderDecisionSummary } from "./renderDecisionSummaries";
import { readStudioRenderDecisionSummary } from "./renderDecisionSummaries";
import type { RunRecord, StudioRunState } from "./runRecordTypes";

type LoadedRunRecord = RunRecord & { runId: string; state: StudioRunState };

export type RunSummaryInputs = {
  channelHandoff: StudioChannelHandoffSummary;
  channelHandoffDecision: StudioChannelHandoffDecisionSummary;
  evidence: StudioEvidenceSummary;
  finalReviewBundle: StudioFinalReviewBundleSummary;
  readiness: Awaited<ReturnType<typeof readStudioReadinessSnapshot>>;
  readinessSummary: StudioReadinessSummary;
  renderDecision: StudioRenderDecisionSummary;
};

/**
 * Loads the shared read-only summaries required by Studio run index and detail views.
 *
 * @param root - The project root containing local run artifacts.
 * @param runId - The run identifier being summarized.
 * @param record - The persisted run record.
 * @returns The evidence, readiness, render-decision, final-review, and handoff summaries.
 */
export async function loadRunSummaryInputs(
  root: string,
  runId: string,
  record: LoadedRunRecord,
): Promise<RunSummaryInputs> {
  const [evidence, readiness] = await Promise.all([
    readStudioEvidenceSummary(root, runId, record.state),
    readStudioReadinessSnapshot(root, runId),
  ]);
  const renderDecision = await readStudioRenderDecisionSummary(root, record, evidence.snapshot);
  const finalReviewBundle = await readStudioFinalReviewBundleSummary(
    root,
    record,
    evidence.snapshot,
    renderDecision,
  );
  const channelHandoff = await readStudioChannelHandoffSummary(root, record, finalReviewBundle);
  const channelHandoffDecision = await readStudioChannelHandoffDecisionSummary(
    root,
    record,
    channelHandoff,
  );
  return {
    channelHandoff,
    channelHandoffDecision,
    evidence,
    finalReviewBundle,
    readiness,
    readinessSummary: summarizeReadinessSnapshot(
      readiness.snapshot,
      record.runId,
      record.state,
      readiness.malformed,
    ),
    renderDecision,
  };
}
