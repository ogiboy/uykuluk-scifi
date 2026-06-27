import { artifactPath } from "../core/artifacts.js";
import { pathExists } from "../utils/fs.js";
import { readJsonFile } from "../utils/json.js";

type ReadinessCheckStatus = "pass" | "warn" | "block";

export type StatusReadinessAttention = {
  message: string;
  name: string;
  nextAction?: string;
  status: Exclude<ReadinessCheckStatus, "pass">;
};

export type StatusReadinessSummary =
  | { status: "missing" }
  | { message: string; status: "invalid" }
  | {
      attention: StatusReadinessAttention[];
      blockCount: number;
      checkCount: number;
      status: "blocked" | "passed";
      warnCount: number;
    };

type PersistedReadinessCheck = {
  message: string;
  name: string;
  nextAction?: string;
  status: ReadinessCheckStatus;
};

export async function readStatusReadiness(runId: string): Promise<StatusReadinessSummary> {
  const target = artifactPath(runId, "diagnostics/readiness.json");
  if (!(await pathExists(target))) {
    return { status: "missing" };
  }
  try {
    return summarizeReadinessArtifact(await readJsonFile<unknown>(target), runId);
  } catch {
    return { message: "diagnostics/readiness.json could not be parsed.", status: "invalid" };
  }
}

export function formatStatusReadiness(readiness: StatusReadinessSummary): string[] {
  if (readiness.status === "missing") {
    return ["Readiness: not generated"];
  }
  if (readiness.status === "invalid") {
    return [`Readiness: invalid (${readiness.message})`];
  }
  return [
    `Readiness: ${readiness.status} (${readiness.checkCount} checks, ${readiness.blockCount} block, ${readiness.warnCount} warn)`,
    ...formatReadinessAttention(readiness.attention),
  ];
}

function summarizeReadinessArtifact(artifact: unknown, runId: string): StatusReadinessSummary {
  if (!isRecord(artifact) || !Array.isArray(artifact.checks)) {
    return { message: "diagnostics/readiness.json is missing a checks array.", status: "invalid" };
  }
  if (!artifact.checks.every(isPersistedReadinessCheck)) {
    return { message: "diagnostics/readiness.json contains an invalid check.", status: "invalid" };
  }
  const checks = artifact.checks;
  const attention = checks.filter(isAttentionCheck).map((check) => ({
    message: check.message,
    name: check.name,
    nextAction: materializeRunCommand(check.nextAction, runId),
    status: check.status,
  }));
  const blockCount = attention.filter((check) => check.status === "block").length;
  const warnCount = attention.length - blockCount;
  return {
    attention,
    blockCount,
    checkCount: checks.length,
    status: blockCount > 0 || artifact.passed !== true ? "blocked" : "passed",
    warnCount,
  };
}

function formatReadinessAttention(attention: readonly StatusReadinessAttention[]): string[] {
  if (attention.length === 0) {
    return [];
  }
  return [
    "Readiness attention:",
    ...attention.flatMap((check) => {
      const line = `- ${check.name} [${check.status}]: ${check.message}`;
      return check.nextAction ? [line, `  Next action: ${check.nextAction}`] : [line];
    }),
  ];
}

function isAttentionCheck(
  check: PersistedReadinessCheck,
): check is PersistedReadinessCheck & { status: "block" | "warn" } {
  return check.status === "block" || check.status === "warn";
}

function isPersistedReadinessCheck(value: unknown): value is PersistedReadinessCheck {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    isReadinessCheckStatus(value.status) &&
    typeof value.message === "string" &&
    (value.nextAction === undefined || typeof value.nextAction === "string")
  );
}

function isReadinessCheckStatus(value: unknown): value is ReadinessCheckStatus {
  return value === "pass" || value === "warn" || value === "block";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function materializeRunCommand(command: string | undefined, runId: string): string | undefined {
  return command?.replaceAll("<run_id>", runId);
}
