import { artifactPath } from "../core/artifacts.js";
import { loadRun } from "../core/runStore.js";
import type { RunRecord, RunState } from "../core/state.js";
import { pathExists } from "../utils/fs.js";
import { readJsonFile } from "../utils/json.js";
import { materializeRunCommand, staticEvidenceNextCommand } from "./evidenceNextCommand.js";
import type { RunDiagnosticSummary } from "./runDiagnosticSummaryContracts.js";
import { readRunDiagnosticSummaries } from "./runDiagnosticSummaries.js";
import {
  formatProductionMediaStatus,
  productionMediaStatus,
  type EvidenceStatus,
  type ProductionMediaStatus,
} from "./statusMedia.js";

type EvidenceReadResult =
  | { kind: "present"; evidence: EvidenceStatus }
  | { kind: "missing" }
  | { kind: "invalid" };

export type RunStatusSummary = {
  approvalCount: number;
  artifactCount: number;
  blockedActionCount: number | null;
  evidencePresent: boolean;
  mediaArtifacts: ProductionMediaStatus[];
  diagnostics: RunDiagnosticSummary[];
  nextRecommendedCommand: string;
  recentArtifacts: string[];
  run: RunRecord;
  warningCount: number;
};

export async function readRunStatus(runId: string): Promise<RunStatusSummary> {
  const run = await loadRun(runId);
  const [evidenceResult, diagnostics] = await Promise.all([
    readEvidenceStatus(run.runId),
    readRunDiagnosticSummaries(run.runId, run.artifacts),
  ]);
  const evidence = evidenceResult.kind === "present" ? evidenceResult.evidence : null;
  return {
    approvalCount: run.approvals.length,
    artifactCount: run.artifacts.length,
    blockedActionCount: Array.isArray(evidence?.blockedActions)
      ? evidence.blockedActions.length
      : null,
    diagnostics,
    evidencePresent: Boolean(evidence),
    mediaArtifacts: productionMediaStatus(run, evidence),
    nextRecommendedCommand: statusNextRecommendedCommand(run.runId, run.state, evidenceResult),
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
    `Evidence: ${status.evidencePresent ? "available" : "missing"}`,
    `Blocked actions: ${status.blockedActionCount ?? "unknown"}`,
    `Next safe action: ${status.nextRecommendedCommand}`,
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

async function readEvidenceStatus(runId: string): Promise<EvidenceReadResult> {
  const target = artifactPath(runId, "evidence_bundle.json");
  if (!(await pathExists(target))) {
    return { kind: "missing" };
  }
  try {
    return { kind: "present", evidence: await readJsonFile<EvidenceStatus>(target) };
  } catch {
    return { kind: "invalid" };
  }
}
