import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  diagnosticSummaryArtifactPaths,
  summarizeRunDiagnosticArtifact,
  type RunDiagnosticSummary,
} from "../../../../src/stages/runDiagnosticSummaryContracts";
import {
  productionMediaStatus,
  type ProductionMediaStatus,
} from "../../../../src/stages/statusMedia";
import { evidenceBlockedActionMessages } from "../../../../src/stages/statusBlockedActions";
import { readReviewArtifactPreviews, type StudioArtifactPreview } from "./artifactPreviews";
import {
  evidenceNextRecommendedCommand,
  readStudioEvidenceSummary,
  type StudioEvidenceSummary,
} from "./evidenceSummaries";
import { projectRoot } from "./projectRoot";
import {
  readStudioReadinessSnapshot,
  type ReadinessSnapshot,
  type StudioReadinessCheck,
  type StudioReadinessSummary,
  summarizeReadinessSnapshot,
} from "./readinessSummaries";

export type StudioRunState =
  | "NEW"
  | "IDEAS_GENERATED"
  | "IDEA_APPROVED"
  | "SCRIPT_GENERATED"
  | "SCRIPT_REVIEWED"
  | "SCRIPT_APPROVED"
  | "PRODUCTION_PACKAGE_GENERATED"
  | "COST_ESTIMATED"
  | "PAID_GENERATION_COST_APPROVED"
  | "READY_FOR_MANUAL_PRODUCTION"
  | "RENDER_APPROVED"
  | "RENDERED"
  | "UPLOAD_APPROVED"
  | "UPLOADED_PRIVATE"
  | "PUBLISH_APPROVED"
  | "SCHEDULED_OR_PUBLIC"
  | "ARCHIVED"
  | "FAILED";

export type StudioRunSummary = {
  approvalCount: number;
  artifactCount: number;
  blockedActions: string[];
  blockedActionCount: number;
  createdAt: string;
  evidenceMessage: string;
  evidenceNextAction?: string;
  evidenceStatus: StudioEvidenceSummary["status"];
  nextRecommendedCommand: string | null;
  readinessPassed: boolean | null;
  readinessMessage: string;
  readinessNextAction?: string;
  readinessStatus: StudioReadinessSummary["status"];
  runId: string;
  state: StudioRunState;
  updatedAt: string;
  warningCount: number;
};

export type StudioRunDetail = StudioRunSummary & {
  approvals: unknown[];
  artifacts: StudioArtifactPreview[];
  diagnostics: RunDiagnosticSummary[];
  evidence: Record<string, unknown> | null;
  productionMedia: ProductionMediaStatus[];
  readiness: ReadinessSnapshot | null;
  readinessChecks: StudioReadinessCheck[];
  warnings: string[];
};

type RunRecord = {
  approvals?: unknown[];
  artifacts?: string[];
  createdAt?: string;
  runId?: string;
  state?: StudioRunState;
  updatedAt?: string;
  warnings?: string[];
};

type ValidRunRecord = RunRecord & {
  runId: string;
  state: StudioRunState;
};

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

export async function getStudioRunDetail(runId: string): Promise<StudioRunDetail | null> {
  if (!isRunId(runId)) {
    return null;
  }
  const root = projectRoot();
  const record = await readRunRecord(root, runId);
  if (!record) {
    return null;
  }
  const [evidence, readiness] = await Promise.all([
    readStudioEvidenceSummary(root, runId, record.state),
    readStudioReadinessSnapshot(root, runId),
  ]);
  const readinessSummary = summarizeReadinessSnapshot(
    readiness.snapshot,
    record.runId,
    record.state,
    readiness.malformed,
  );
  const summary = summarizeRun(record, evidence, readinessSummary);
  return {
    ...summary,
    approvals: record.approvals ?? [],
    artifacts: await readReviewArtifactPreviews(root, runId),
    diagnostics: await readStudioRunDiagnostics(root, runId, record.artifacts ?? []),
    evidence: evidence.snapshot,
    productionMedia: productionMediaStatus(
      { artifacts: record.artifacts ?? [] },
      evidence.snapshot,
    ),
    readiness: readiness.snapshot,
    readinessChecks: readinessSummary.checks,
    warnings: record.warnings ?? [],
  };
}

async function readRunSummary(root: string, runId: string): Promise<StudioRunSummary | null> {
  const record = await readRunRecord(root, runId);
  if (!record) {
    return null;
  }
  const [evidence, readiness] = await Promise.all([
    readStudioEvidenceSummary(root, runId, record.state),
    readStudioReadinessSnapshot(root, runId),
  ]);
  return summarizeRun(
    record,
    evidence,
    summarizeReadinessSnapshot(readiness.snapshot, record.runId, record.state, readiness.malformed),
  );
}

function summarizeRun(
  record: RunRecord,
  evidence: StudioEvidenceSummary,
  readiness: StudioReadinessSummary,
): StudioRunSummary {
  const runId = record.runId ?? "unknown";
  const blockedActions = evidenceBlockedActionMessages(evidence.snapshot, runId);
  return {
    approvalCount: record.approvals?.length ?? 0,
    artifactCount: record.artifacts?.length ?? 0,
    blockedActionCount: blockedActions.length,
    blockedActions,
    createdAt: record.createdAt ?? "",
    evidenceMessage: evidence.message,
    evidenceNextAction: evidence.nextAction,
    evidenceStatus: evidence.status,
    nextRecommendedCommand: evidenceNextRecommendedCommand(
      evidence,
      record.state ?? "FAILED",
      runId,
    ),
    readinessMessage: readiness.message,
    readinessNextAction: readiness.nextAction,
    readinessPassed: readiness.passed,
    readinessStatus: readiness.status,
    runId,
    state: record.state ?? "FAILED",
    updatedAt: record.updatedAt ?? record.createdAt ?? "",
    warningCount: record.warnings?.length ?? 0,
  };
}

async function readStudioRunDiagnostics(
  root: string,
  runId: string,
  artifacts: readonly string[],
): Promise<RunDiagnosticSummary[]> {
  const summaries: RunDiagnosticSummary[] = [];
  for (const relativePath of diagnosticSummaryArtifactPaths) {
    if (!artifacts.includes(relativePath)) {
      continue;
    }
    const snapshot = await readOptionalJson<Record<string, unknown>>(root, runId, relativePath);
    if (!snapshot) {
      continue;
    }
    const summary = summarizeRunDiagnosticArtifact(relativePath, snapshot);
    if (summary) {
      summaries.push(summary);
    }
  }
  return summaries;
}

async function readRunRecord(root: string, runId: string): Promise<ValidRunRecord | null> {
  const record = await readOptionalJson<RunRecord>(root, runId, "state.json");
  if (record?.runId !== runId || !record.state) {
    return null;
  }
  return { ...record, runId: record.runId, state: record.state };
}

async function readOptionalJson<T>(
  root: string,
  runId: string,
  relativePath: string,
): Promise<T | null> {
  try {
    const file = path.join(root, "runs", runId, ...relativePath.split("/"));
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    return null;
  }
}

async function safeReaddir(
  target: string,
): Promise<Array<{ isDirectory: () => boolean; name: string }>> {
  try {
    return await readdir(target, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

function isRunId(value: string): boolean {
  return /^run_[A-Za-z0-9][A-Za-z0-9_-]{0,123}$/.test(value);
}
