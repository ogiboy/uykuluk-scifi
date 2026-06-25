import { artifactPath } from "../core/artifacts.js";
import { loadRun } from "../core/runStore.js";
import type { RunRecord, RunState } from "../core/state.js";
import { pathExists } from "../utils/fs.js";
import { readJsonFile } from "../utils/json.js";
import { staticEvidenceNextCommand } from "./evidenceNextCommand.js";
import type { RunDiagnosticSummary } from "./runDiagnosticSummaryContracts.js";
import { readRunDiagnosticSummaries } from "./runDiagnosticSummaries.js";

type EvidenceStatus = {
  blockedActions?: unknown[];
  draftRender?: { status?: unknown };
  nextRecommendedCommand?: unknown;
  renderPlan?: { status?: unknown };
  voiceoverAudio?: { status?: unknown };
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
    ...formatDiagnostics(status.diagnostics),
    "",
    "Production media:",
    ...status.mediaArtifacts.map((artifact) => `- ${artifact.label}: ${artifact.status}`),
    "",
    "Recent artifacts:",
    ...(status.recentArtifacts.length > 0
      ? status.recentArtifacts.map((artifact) => `- ${artifact}`)
      : ["- none"]),
  ].join("\n");
}

type ProductionMediaStatus = {
  artifactPath: string;
  label: string;
  status: "block" | "missing" | "pass" | "recorded";
};

const PRODUCTION_MEDIA_ARTIFACTS = [
  {
    evidenceKey: "renderPlan",
    label: "Render plan",
    path: "production/render_plan.json",
  },
  {
    evidenceKey: "voiceoverAudio",
    label: "Voiceover audio",
    path: "production/audio/voiceover.wav",
  },
  {
    evidenceKey: "draftRender",
    label: "Draft render",
    path: "production/render/draft.mp4",
  },
] as const;

function productionMediaStatus(
  run: RunRecord,
  evidence: EvidenceStatus | null,
): ProductionMediaStatus[] {
  return PRODUCTION_MEDIA_ARTIFACTS.map((item) => ({
    artifactPath: item.path,
    label: item.label,
    status: mediaArtifactStatus(run, evidence?.[item.evidenceKey]?.status, item.path),
  }));
}

function mediaArtifactStatus(
  run: RunRecord,
  evidenceStatus: unknown,
  artifactPath: string,
): ProductionMediaStatus["status"] {
  if (evidenceStatus === "pass" || evidenceStatus === "block" || evidenceStatus === "missing") {
    return evidenceStatus;
  }
  return run.artifacts.includes(artifactPath) ? "recorded" : "missing";
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
