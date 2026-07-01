import { loadRun } from "../core/runStore.js";
import type { RunRecord } from "../core/state.js";
import type { RunDiagnosticSummary } from "./runDiagnosticSummaryContracts.js";
import { readRunDiagnosticSummaries } from "./runDiagnosticSummaries.js";
import {
  formatProductionMediaStatus,
  productionMediaReviewAction,
  productionMediaStatus,
  type ProductionMediaStatus,
} from "./statusMedia.js";
import { evidenceBlockedActionMessages } from "./statusBlockedActions.js";
import { formatDiagnostics } from "./statusDiagnostics.js";
import { readEvidenceStatus, type EvidenceReadResult } from "./statusEvidence.js";
import { readRenderDecisionStatus, type RenderDecisionStatus } from "./renderDecisionStatus.js";
import {
  readFinalReviewBundleStatus,
  type FinalReviewBundleStatus,
} from "./finalReviewBundleStatus.js";
import { readChannelHandoffStatus, type ChannelHandoffStatus } from "./channelHandoffStatus.js";
import {
  readChannelHandoffDecisionStatus,
  type ChannelHandoffDecisionStatus,
} from "./channelHandoffDecisionStatus.js";
import {
  formatStatusReadiness,
  readStatusReadiness,
  type StatusReadinessSummary,
} from "./statusReadiness.js";
import { formatFinalReviewBundleStatus } from "./statusFinalReviewBundle.js";
import { formatChannelHandoffStatus } from "./statusChannelHandoff.js";
import { formatApprovalLedger, formatWarningDetails } from "./statusLedger.js";
import { statusNextRecommendedCommand } from "./statusNextRecommended.js";

export type RunStatusSummary = {
  approvalCount: number;
  artifactCount: number;
  blockedActions: string[];
  blockedActionCount: number | null;
  evidenceMessage: string | null;
  evidencePresent: boolean;
  evidenceStatus: EvidenceReadResult["kind"];
  mediaArtifacts: ProductionMediaStatus[];
  diagnostics: RunDiagnosticSummary[];
  channelHandoff: ChannelHandoffStatus;
  channelHandoffDecision: ChannelHandoffDecisionStatus;
  finalReviewBundle: FinalReviewBundleStatus;
  nextRecommendedCommand: string;
  readiness: StatusReadinessSummary;
  recentArtifacts: string[];
  renderDecision: RenderDecisionStatus;
  run: RunRecord;
  warningCount: number;
};

/**
 * Loads a run and compiles a combined status summary.
 *
 * The summary includes evidence, diagnostics, readiness, render decision state, media status, and the next recommended command.
 *
 * @param runId - The run identifier
 * @returns The combined status summary for the run
 */
export async function readRunStatus(runId: string): Promise<RunStatusSummary> {
  const run = await loadRun(runId);
  const [evidenceResult, diagnostics, readiness, renderDecision, finalReviewBundle] =
    await Promise.all([
      readEvidenceStatus(run.runId, run.state),
      readRunDiagnosticSummaries(run.runId, run.artifacts),
      readStatusReadiness(run.runId, run.state),
      readRenderDecisionStatus(run),
      readFinalReviewBundleStatus(run),
    ]);
  const channelHandoff = await readChannelHandoffStatus(run, finalReviewBundle);
  const channelHandoffDecision = await readChannelHandoffDecisionStatus(run, channelHandoff);
  const evidence = evidenceResult.kind === "present" ? evidenceResult.evidence : null;
  const blockedActions = evidenceBlockedActionMessages(evidence, run.runId);
  return {
    approvalCount: run.approvals.length,
    artifactCount: run.artifacts.length,
    blockedActionCount: evidence ? blockedActions.length : null,
    blockedActions,
    channelHandoff,
    channelHandoffDecision,
    diagnostics,
    evidenceMessage: "message" in evidenceResult ? evidenceResult.message : null,
    evidencePresent: Boolean(evidence),
    evidenceStatus: evidenceResult.kind,
    finalReviewBundle,
    mediaArtifacts: productionMediaStatus(run, evidence),
    nextRecommendedCommand: statusNextRecommendedCommand(
      run.runId,
      run.state,
      evidenceResult,
      renderDecision,
      finalReviewBundle,
      channelHandoff,
      channelHandoffDecision,
    ),
    readiness,
    recentArtifacts: run.artifacts.slice(-5).reverse(),
    renderDecision,
    run,
    warningCount: run.warnings.length,
  };
}

/**
 * Renders a run status summary as a multiline operator report.
 *
 * The report includes run metadata, evidence status, readiness, render decision details,
 * blocked actions, diagnostics, production media, and recent artifacts.
 *
 * @param status - The run status summary to format
 * @returns A newline-delimited report
 */
export function formatRunStatus(status: RunStatusSummary): string {
  return [
    `Run: ${status.run.runId}`,
    `State: ${status.run.state}`,
    `Updated: ${status.run.updatedAt}`,
    `Approvals: ${status.approvalCount}`,
    `Warnings: ${status.warningCount}`,
    `Artifacts: ${status.artifactCount}`,
    ...formatApprovalLedger(status.run.approvals),
    ...formatWarningDetails(status.run.warnings),
    ...formatEvidenceStatusForRun(status),
    `Blocked actions: ${status.blockedActionCount ?? "unknown"}`,
    `Next safe action: ${status.nextRecommendedCommand}`,
    ...formatStatusReadiness(status.readiness),
    ...formatRenderDecisionStatus(status.renderDecision),
    ...formatFinalReviewBundleStatus(status.finalReviewBundle),
    ...formatChannelHandoffStatus(status.channelHandoff),
    ...formatChannelHandoffDecisionStatus(status.channelHandoffDecision),
    ...formatBlockedActions(status.blockedActions),
    ...formatDiagnostics(status.diagnostics),
    ...formatProductionMediaEvidenceForRun(status),
    ...formatProductionMediaRows(status),
    "",
    "Recent artifacts:",
    ...(status.recentArtifacts.length > 0
      ? status.recentArtifacts.map((artifact) => `- ${artifact}`)
      : ["- none"]),
  ].join("\n");
}

function formatChannelHandoffDecisionStatus(decision: ChannelHandoffDecisionStatus): string[] {
  if (decision.kind === "missing") {
    return decision.nextAction
      ? [
          "Channel handoff decision: missing",
          `Channel handoff decision next action: ${decision.nextAction}`,
        ]
      : ["Channel handoff decision: not applicable"];
  }
  if (decision.kind === "present") {
    return [
      `Channel handoff decision: ${decision.decision.decision} by ${decision.decision.reviewedBy}`,
      `Channel handoff decision artifact: ${decision.reviewPath}`,
      `Channel handoff decision next action: ${decision.nextAction}`,
    ];
  }
  return [
    `Channel handoff decision: ${decision.kind} (${decision.message})`,
    `Channel handoff decision next action: ${decision.nextAction}`,
  ];
}

/**
 * Formats production media rows with conservative review guidance.
 *
 * @param status - The run status summary to render.
 * @returns Lines for each production media row.
 */
function formatProductionMediaRows(status: RunStatusSummary): string[] {
  const evidenceIsCurrent = status.evidenceStatus === "present";
  return status.mediaArtifacts.flatMap((artifact) => [
    formatProductionMediaStatus(artifact),
    `  Review: ${productionMediaReviewAction(artifact, evidenceIsCurrent)}`,
  ]);
}

/**
 * Formats the production media evidence section for a run status report.
 *
 * @param status - The run status summary to render.
 * @returns The production media evidence lines.
 */
function formatProductionMediaEvidenceForRun(status: RunStatusSummary): string[] {
  if (status.evidenceStatus === "present") {
    return ["", "Production media evidence: current evidence bundle.", "Production media:"];
  }
  return [
    "",
    `Production media evidence: artifact-record fallback because evidence is ${status.evidenceStatus}.`,
    "Regenerate evidence before treating production media rows as review proof.",
    `Production media evidence action: pnpm producer evidence --run ${status.run.runId}`,
    "Production media:",
  ];
}

/**
 * Formats the evidence status and next action for a run.
 *
 * @param status - The run status summary to format
 * @returns Lines describing evidence availability or the current evidence status and next action
 */
function formatEvidenceStatusForRun(status: RunStatusSummary): string[] {
  if (status.evidenceStatus === "present") {
    return ["Evidence: available"];
  }
  if (status.evidenceStatus === "missing") {
    return ["Evidence: missing"];
  }
  return [
    `Evidence: ${status.evidenceStatus} (${status.evidenceMessage ?? "evidence_bundle.json is unavailable."})`,
    `Evidence next action: pnpm producer evidence --run ${status.run.runId}`,
  ];
}

/**
 * Formats blocked actions for display.
 *
 * @param blockedActions - The blocked action messages to render
 * @returns Section lines for the blocked actions list, or an empty array when there are no blocked actions
 */
function formatBlockedActions(blockedActions: readonly string[]): string[] {
  if (blockedActions.length === 0) {
    return [];
  }
  return ["", "Blocked action details:", ...blockedActions.map((item) => `- ${item}`)];
}

/**
 * Formats the durable render decision status for operator output.
 *
 * @param decision - The render decision status.
 * @returns Lines describing the render decision and any next action.
 */
function formatRenderDecisionStatus(decision: RenderDecisionStatus): string[] {
  if (decision.kind === "missing") {
    return decision.nextAction
      ? ["Render decision: missing", `Render decision next action: ${decision.nextAction}`]
      : ["Render decision: not applicable"];
  }
  if (decision.kind === "present") {
    return [
      `Render decision: ${decision.decision.decision} by ${decision.decision.reviewedBy}`,
      `Render decision review: ${decision.reviewCommand}`,
      `Render decision next action: ${decision.nextAction}`,
    ];
  }
  return [
    `Render decision: ${decision.kind} (${decision.message})`,
    `Render decision next action: ${decision.nextAction}`,
  ];
}
