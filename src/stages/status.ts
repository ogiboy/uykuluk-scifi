import { artifactPath } from "../core/artifacts.js";
import { loadRun } from "../core/runStore.js";
import type { RunRecord, RunState } from "../core/state.js";
import { pathExists } from "../utils/fs.js";
import { readJsonFile } from "../utils/json.js";
import { staticEvidenceNextCommand } from "./evidenceNextCommand.js";

type EvidenceStatus = {
  blockedActions?: unknown[];
  nextRecommendedCommand?: unknown;
};

type EvidenceReadResult =
  | { kind: "present"; evidence: EvidenceStatus }
  | { kind: "missing" }
  | { kind: "invalid" };

export type RunStatusSummary = {
  approvalCount: number;
  artifactCount: number;
  blockedActionCount: number | null;
  evidencePresent: boolean;
  nextRecommendedCommand: string;
  recentArtifacts: string[];
  run: RunRecord;
  warningCount: number;
};

export async function readRunStatus(runId: string): Promise<RunStatusSummary> {
  const run = await loadRun(runId);
  const evidenceResult = await readEvidenceStatus(run.runId);
  const evidence = evidenceResult.kind === "present" ? evidenceResult.evidence : null;
  return {
    approvalCount: run.approvals.length,
    artifactCount: run.artifacts.length,
    blockedActionCount: Array.isArray(evidence?.blockedActions)
      ? evidence.blockedActions.length
      : null,
    evidencePresent: Boolean(evidence),
    nextRecommendedCommand: statusNextRecommendedCommand(run.state, evidenceResult),
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
    "",
    "Recent artifacts:",
    ...(status.recentArtifacts.length > 0
      ? status.recentArtifacts.map((artifact) => `- ${artifact}`)
      : ["- none"]),
  ].join("\n");
}

function statusNextRecommendedCommand(state: RunState, evidenceResult: EvidenceReadResult): string {
  if (
    evidenceResult.kind === "present" &&
    typeof evidenceResult.evidence.nextRecommendedCommand === "string"
  ) {
    return evidenceResult.evidence.nextRecommendedCommand;
  }
  if (evidenceResult.kind === "missing") {
    return staticEvidenceNextCommand(state) ?? "pnpm producer evidence --run <run_id>";
  }
  return "pnpm producer evidence --run <run_id>";
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
