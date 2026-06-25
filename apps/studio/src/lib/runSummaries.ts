import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { staticEvidenceNextCommand } from "../../../../src/stages/evidenceNextCommand";
import { readReviewArtifactPreviews, type StudioArtifactPreview } from "./artifactPreviews";

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
  blockedActionCount: number;
  createdAt: string;
  nextRecommendedCommand: string | null;
  readinessPassed: boolean | null;
  runId: string;
  state: StudioRunState;
  updatedAt: string;
  warningCount: number;
};

export type StudioRunDetail = StudioRunSummary & {
  approvals: unknown[];
  artifacts: StudioArtifactPreview[];
  evidence: Record<string, unknown> | null;
  readiness: { checks?: unknown[]; passed?: boolean } | null;
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

type EvidenceSnapshot = {
  blockedActions?: unknown[];
  nextRecommendedCommand?: unknown;
};

type ReadinessSnapshot = {
  checks?: unknown[];
  passed?: boolean;
};

export async function listStudioRuns(): Promise<StudioRunSummary[]> {
  const root = await projectRoot();
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
  const root = await projectRoot();
  const record = await readRunRecord(root, runId);
  if (!record) {
    return null;
  }
  const [evidence, readiness] = await Promise.all([
    readOptionalJson<EvidenceSnapshot>(root, runId, "evidence_bundle.json"),
    readOptionalJson<ReadinessSnapshot>(root, runId, "diagnostics/readiness.json"),
  ]);
  const summary = summarizeRun(record, evidence, readiness);
  return {
    ...summary,
    approvals: record.approvals ?? [],
    artifacts: await readReviewArtifactPreviews(root, runId),
    evidence: evidence ?? null,
    readiness: readiness ?? null,
    warnings: record.warnings ?? [],
  };
}

async function readRunSummary(root: string, runId: string): Promise<StudioRunSummary | null> {
  const record = await readRunRecord(root, runId);
  if (!record) {
    return null;
  }
  const [evidence, readiness] = await Promise.all([
    readOptionalJson<EvidenceSnapshot>(root, runId, "evidence_bundle.json"),
    readOptionalJson<ReadinessSnapshot>(root, runId, "diagnostics/readiness.json"),
  ]);
  return summarizeRun(record, evidence, readiness);
}

function summarizeRun(
  record: RunRecord,
  evidence: EvidenceSnapshot | null,
  readiness: ReadinessSnapshot | null,
): StudioRunSummary {
  return {
    approvalCount: record.approvals?.length ?? 0,
    artifactCount: record.artifacts?.length ?? 0,
    blockedActionCount: Array.isArray(evidence?.blockedActions)
      ? evidence.blockedActions.length
      : 0,
    createdAt: record.createdAt ?? "",
    nextRecommendedCommand:
      typeof evidence?.nextRecommendedCommand === "string"
        ? evidence.nextRecommendedCommand
        : (staticEvidenceNextCommand(record.state ?? "FAILED") ?? null),
    readinessPassed: typeof readiness?.passed === "boolean" ? readiness.passed : null,
    runId: record.runId ?? "unknown",
    state: record.state ?? "FAILED",
    updatedAt: record.updatedAt ?? record.createdAt ?? "",
    warningCount: record.warnings?.length ?? 0,
  };
}

async function readRunRecord(root: string, runId: string): Promise<RunRecord | null> {
  const record = await readOptionalJson<RunRecord>(root, runId, "state.json");
  if (record?.runId !== runId || !record.state) {
    return null;
  }
  return record;
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

async function projectRoot(): Promise<string> {
  if (process.env.UYKULUK_SCIFI_ROOT) {
    return process.env.UYKULUK_SCIFI_ROOT;
  }
  let current = process.cwd();
  for (;;) {
    try {
      const pkg = JSON.parse(await readFile(path.join(current, "package.json"), "utf8")) as {
        name?: string;
      };
      if (pkg.name === "uykuluk-scifi") {
        return current;
      }
    } catch {
      // Continue walking upward.
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return process.cwd();
    }
    current = parent;
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
