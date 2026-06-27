import { loadRun } from "../core/runStore.js";
import type { RunRecord, RunState } from "../core/state.js";
import { materializeRunCommand, staticEvidenceNextCommand } from "./evidenceNextCommand.js";
import type { RunDiagnosticSummary } from "./runDiagnosticSummaryContracts.js";
import { readRunDiagnosticSummaries } from "./runDiagnosticSummaries.js";
import {
  formatProductionMediaStatus,
  productionMediaStatus,
  type ProductionMediaStatus,
} from "./statusMedia.js";
import { evidenceBlockedActionMessages } from "./statusBlockedActions.js";
import { readEvidenceStatus, type EvidenceReadResult } from "./statusEvidence.js";
import {
  formatStatusReadiness,
  readStatusReadiness,
  type StatusReadinessSummary,
} from "./statusReadiness.js";

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
  nextRecommendedCommand: string;
  readiness: StatusReadinessSummary;
  recentArtifacts: string[];
  run: RunRecord;
  warningCount: number;
};

export async function readRunStatus(runId: string): Promise<RunStatusSummary> {
  const run = await loadRun(runId);
  const [evidenceResult, diagnostics, readiness] = await Promise.all([
    readEvidenceStatus(run.runId, run.state),
    readRunDiagnosticSummaries(run.runId, run.artifacts),
    readStatusReadiness(run.runId, run.state),
  ]);
  const evidence = evidenceResult.kind === "present" ? evidenceResult.evidence : null;
  const blockedActions = evidenceBlockedActionMessages(evidence, run.runId);
  return {
    approvalCount: run.approvals.length,
    artifactCount: run.artifacts.length,
    blockedActionCount: evidence ? blockedActions.length : null,
    blockedActions,
    diagnostics,
    evidenceMessage: "message" in evidenceResult ? evidenceResult.message : null,
    evidencePresent: Boolean(evidence),
    evidenceStatus: evidenceResult.kind,
    mediaArtifacts: productionMediaStatus(run, evidence),
    nextRecommendedCommand: statusNextRecommendedCommand(run.runId, run.state, evidenceResult),
    readiness,
    recentArtifacts: run.artifacts.slice(-5).reverse(),
    run,
    warningCount: run.warnings.length,
  };
}

export function formatRunStatus(status: RunStatusSummary): string {
  return [
    `Run: ${status.run.runId}`,
    `State: ${status.run.state}`,
    `Updated: ${status.run.updatedAt}`,
    `Approvals: ${status.approvalCount}`,
    `Warnings: ${status.warningCount}`,
    `Artifacts: ${status.artifactCount}`,
    ...formatEvidenceStatusForRun(status),
    `Blocked actions: ${status.blockedActionCount ?? "unknown"}`,
    `Next safe action: ${status.nextRecommendedCommand}`,
    ...formatStatusReadiness(status.readiness),
    ...formatBlockedActions(status.blockedActions),
    ...formatDiagnostics(status.diagnostics),
    "",
    "Production media:",
    ...status.mediaArtifacts.map(formatProductionMediaStatus),
    "",
    "Recent artifacts:",
    ...(status.recentArtifacts.length > 0
      ? status.recentArtifacts.map((artifact) => `- ${artifact}`)
      : ["- none"]),
  ].join("\n");
}

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

function formatBlockedActions(blockedActions: readonly string[]): string[] {
  if (blockedActions.length === 0) {
    return [];
  }
  return ["", "Blocked action details:", ...blockedActions.map((item) => `- ${item}`)];
}

function formatDiagnostics(diagnostics: readonly RunDiagnosticSummary[]): string[] {
  if (diagnostics.length === 0) {
    return [];
  }
  return [
    "",
    "Diagnostics:",
    ...diagnostics.map(
      (diagnostic) => `- ${diagnostic.path} [${diagnostic.stage}]: ${diagnostic.message}`,
    ),
  ];
}

function statusNextRecommendedCommand(
  runId: string,
  state: RunState,
  evidenceResult: EvidenceReadResult,
): string {
  if (
    evidenceResult.kind === "present" &&
    typeof evidenceResult.evidence.nextRecommendedCommand === "string"
  ) {
    return materializeRunCommand(evidenceResult.evidence.nextRecommendedCommand, runId);
  }
  if (evidenceResult.kind === "missing") {
    return materializeRunCommand(
      staticEvidenceNextCommand(state) ?? "pnpm producer evidence --run <run_id>",
      runId,
    );
  }
  return `pnpm producer evidence --run ${runId}`;
}
