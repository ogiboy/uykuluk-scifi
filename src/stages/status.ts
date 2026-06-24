import { artifactPath } from "../core/artifacts.js";
import { loadRun } from "../core/runStore.js";
import type { RunRecord } from "../core/state.js";
import { pathExists } from "../utils/fs.js";
import { readJsonFile } from "../utils/json.js";

type EvidenceStatus = {
  blockedActions?: unknown[];
  nextRecommendedCommand?: unknown;
};

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
  const evidence = await readEvidenceStatus(run.runId);
  return {
    approvalCount: run.approvals.length,
    artifactCount: run.artifacts.length,
    blockedActionCount: Array.isArray(evidence?.blockedActions)
      ? evidence.blockedActions.length
      : null,
    evidencePresent: Boolean(evidence),
    nextRecommendedCommand:
      typeof evidence?.nextRecommendedCommand === "string"
        ? evidence.nextRecommendedCommand
        : "pnpm producer evidence --run <run_id>",
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

async function readEvidenceStatus(runId: string): Promise<EvidenceStatus | null> {
  const target = artifactPath(runId, "evidence_bundle.json");
  if (!(await pathExists(target))) {
    return null;
  }
  try {
    return await readJsonFile<EvidenceStatus>(target);
  } catch {
    return null;
  }
}
