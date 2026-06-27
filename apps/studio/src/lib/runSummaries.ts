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

/**
 * Builds a compact summary for a studio run.
 *
 * @param record - The stored run record.
 * @param evidence - The evidence summary for the run.
 * @param readiness - The readiness summary for the run.
 * @returns The combined run summary.
 */
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

/**
 * Loads diagnostic summaries for the available artifacts in a run.
 *
 * @param root - The project root directory
 * @param runId - The run identifier
 * @param artifacts - Artifact paths present for the run
 * @returns The diagnostic summaries that could be read and summarized
 */
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

/**
 * Reads a validated run record from `state.json`.
 *
 * @param root - The project root directory
 * @param runId - The run identifier to load
 * @returns The validated run record, or `null` if the file is missing or invalid
 */
async function readRunRecord(root: string, runId: string): Promise<ValidRunRecord | null> {
  const record = await readOptionalJson<RunRecord>(root, runId, "state.json");
  if (record?.runId !== runId || !record.state) {
    return null;
  }
  return { ...record, runId: record.runId, state: record.state };
}

/**
 * Reads and parses an optional JSON artifact from a run directory.
 *
 * @param root - The project root directory
 * @param runId - The run directory name
 * @param relativePath - The JSON file path relative to the run directory
 * @returns The parsed JSON value, or `null` if the file cannot be read or parsed
 */
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

/**
 * Reads directory entries and returns an empty list when the directory is missing.
 *
 * @param target - The directory path to read
 * @returns The directory entries, or an empty array if the directory does not exist
 */
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
