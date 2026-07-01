import path from "node:path";
import type { RunDiagnosticSummary } from "../../../../src/stages/runDiagnosticSummaryContracts";
import {
  productionMediaStatus,
  type ProductionMediaStatus,
} from "../../../../src/stages/statusMediaSummary";
import type { RenderDecisionCommandTemplate } from "../../../../src/stages/renderDecisionCommands";
import type { StatusWorkflowStep } from "../../../../src/stages/statusWorkflow";
import { evidenceBlockedActionMessages } from "../../../../src/stages/statusBlockedActions";
import { readReviewArtifactPreviews, type StudioArtifactPreview } from "./artifactPreviews";
import type { StudioChannelHandoffDecisionSummary } from "./channelHandoffDecisionSummaries";
import type { StudioChannelHandoffSummary } from "./channelHandoffSummaries";
import type { StudioEvidenceSummary } from "./evidenceSummaries";
import type { StudioFinalReviewBundleSummary } from "./finalReviewBundleSummaries";
import { projectRoot } from "./projectRoot";
import {
  type ReadinessSnapshot,
  type StudioReadinessCheck,
  type StudioReadinessSummary,
} from "./readinessSummaries";
import type { StudioRenderDecisionSummary } from "./renderDecisionSummaries";
import {
  studioNextRecommendedCommand,
  studioRenderDecisionCommands,
  studioWorkflowProgress,
} from "./runDecisionProjection";
import { loadRunSummaryInputs } from "./runSummaryInputs";
import type { RunRecord, StudioRunState } from "./runRecordTypes";
import { isRunId, readRunRecord, readStudioRunDiagnostics, safeReaddir } from "./runSummaryFiles";

export type StudioRunSummary = {
  approvalCount: number;
  artifactCount: number;
  blockedActions: string[];
  blockedActionCount: number;
  channelHandoff: StudioChannelHandoffSummary;
  channelHandoffDecision: StudioChannelHandoffDecisionSummary;
  createdAt: string;
  evidenceMessage: string;
  evidenceNextAction?: string;
  evidenceStatus: StudioEvidenceSummary["status"];
  finalReviewBundle: StudioFinalReviewBundleSummary;
  nextRecommendedCommand: string | null;
  readinessPassed: boolean | null;
  readinessMessage: string;
  readinessNextAction?: string;
  readinessStatus: StudioReadinessSummary["status"];
  renderDecision: StudioRenderDecisionSummary;
  runId: string;
  state: StudioRunState;
  updatedAt: string;
  warningCount: number;
  workflowProgress: StatusWorkflowStep[];
};

export type StudioRunDetail = StudioRunSummary & {
  approvals: unknown[];
  artifacts: StudioArtifactPreview[];
  diagnostics: RunDiagnosticSummary[];
  evidence: Record<string, unknown> | null;
  productionMedia: ProductionMediaStatus[];
  readiness: ReadinessSnapshot | null;
  readinessChecks: StudioReadinessCheck[];
  renderDecisionCommands: RenderDecisionCommandTemplate[];
  warnings: string[];
};

/**
 * Lists the available studio runs.
 *
 * @returns The studio run summaries, sorted by most recently updated first.
 */
export async function listStudioRuns(): Promise<StudioRunSummary[]> {
  const root = projectRoot();
  const runsDir = path.join(root, "runs");
  const entries = await safeReaddir(runsDir);
  const summaries = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && isRunId(entry.name))
      .map((entry) => readRunSummary(root, entry.name)),
  );
  return summaries
    .filter((summary): summary is StudioRunSummary => Boolean(summary))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * Loads detailed information for a studio run.
 *
 * @param runId - The run identifier to load.
 * @returns The run detail, or `null` if the run ID is invalid or the run record cannot be found.
 */
export async function getStudioRunDetail(runId: string): Promise<StudioRunDetail | null> {
  if (!isRunId(runId)) {
    return null;
  }
  const root = projectRoot();
  const record = await readRunRecord(root, runId);
  if (!record) {
    return null;
  }
  const inputs = await loadRunSummaryInputs(root, runId, record);
  const summary = summarizeRun(
    record,
    inputs.evidence,
    inputs.readinessSummary,
    inputs.renderDecision,
    inputs.finalReviewBundle,
    inputs.channelHandoff,
    inputs.channelHandoffDecision,
  );
  return {
    ...summary,
    approvals: record.approvals ?? [],
    artifacts: await readReviewArtifactPreviews(root, runId),
    diagnostics: await readStudioRunDiagnostics(root, runId, record.artifacts ?? []),
    evidence: inputs.evidence.snapshot,
    productionMedia: productionMediaStatus(
      { artifacts: record.artifacts ?? [], runId: record.runId },
      inputs.evidence.snapshot,
    ),
    readiness: inputs.readiness.snapshot,
    readinessChecks: inputs.readinessSummary.checks,
    renderDecisionCommands: studioRenderDecisionCommands(
      record,
      inputs.evidence,
      inputs.renderDecision,
    ),
    warnings: record.warnings ?? [],
  };
}

/**
 * Builds a summary for a studio run.
 *
 * @param root - The project root directory
 * @param runId - The run identifier
 * @returns The run summary, or `null` if the run record cannot be read
 */
async function readRunSummary(root: string, runId: string): Promise<StudioRunSummary | null> {
  const record = await readRunRecord(root, runId);
  if (!record) {
    return null;
  }
  const inputs = await loadRunSummaryInputs(root, runId, record);
  return summarizeRun(
    record,
    inputs.evidence,
    inputs.readinessSummary,
    inputs.renderDecision,
    inputs.finalReviewBundle,
    inputs.channelHandoff,
    inputs.channelHandoffDecision,
  );
}

/**
 * Builds a compact summary for a studio run.
 *
 * @param record - The stored run record.
 * @param evidence - The evidence summary for the run.
 * @param readiness - The readiness summary for the run.
 * @param renderDecision - The local render decision summary for the run.
 * @param finalReviewBundle - The local final review bundle summary for the run.
 * @param channelHandoff - The manual channel handoff summary for the run.
 * @param channelHandoffDecision - The manual channel handoff decision summary for the run.
 * @returns The combined run summary.
 */
function summarizeRun(
  record: RunRecord,
  evidence: StudioEvidenceSummary,
  readiness: StudioReadinessSummary,
  renderDecision: StudioRenderDecisionSummary,
  finalReviewBundle: StudioFinalReviewBundleSummary,
  channelHandoff: StudioChannelHandoffSummary,
  channelHandoffDecision: StudioChannelHandoffDecisionSummary,
): StudioRunSummary {
  const runId = record.runId ?? "unknown";
  const blockedActions = evidenceBlockedActionMessages(evidence.snapshot, runId);
  const productionMedia = productionMediaStatus(
    { artifacts: record.artifacts ?? [], runId },
    evidence.snapshot,
  );
  return {
    approvalCount: record.approvals?.length ?? 0,
    artifactCount: record.artifacts?.length ?? 0,
    blockedActionCount: blockedActions.length,
    blockedActions,
    channelHandoff,
    channelHandoffDecision,
    createdAt: record.createdAt ?? "",
    evidenceMessage: evidence.message,
    evidenceNextAction: evidence.nextAction,
    evidenceStatus: evidence.status,
    finalReviewBundle,
    nextRecommendedCommand: studioNextRecommendedCommand(
      evidence,
      record.state ?? "FAILED",
      runId,
      renderDecision,
      finalReviewBundle,
      channelHandoff,
      channelHandoffDecision,
    ),
    readinessMessage: readiness.message,
    readinessNextAction: readiness.nextAction,
    readinessPassed: readiness.passed,
    readinessStatus: readiness.status,
    renderDecision,
    runId,
    state: record.state ?? "FAILED",
    updatedAt: record.updatedAt ?? record.createdAt ?? "",
    warningCount: record.warnings?.length ?? 0,
    workflowProgress: studioWorkflowProgress({
      channelHandoff,
      finalReviewBundle,
      mediaArtifacts: productionMedia,
      readinessStatus: readiness.status,
      renderDecision,
      state: record.state ?? "FAILED",
    }),
  };
}
