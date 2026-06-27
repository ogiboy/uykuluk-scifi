import { artifactPath } from "../core/artifacts.js";
import type { RunState } from "../core/state.js";
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
  | { nextAction: string; status: "missing" }
  | { message: string; nextAction: string; status: "invalid" | "stale" }
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

/**
 * Reads and summarizes the readiness diagnostics for a run.
 *
 * @param runId - The run identifier used to locate the readiness artifact.
 * @param currentState - The current run state used to validate the artifact.
 * @returns A readiness summary for the run.
 */
export async function readStatusReadiness(
  runId: string,
  currentState: RunState,
): Promise<StatusReadinessSummary> {
  const target = artifactPath(runId, "diagnostics/readiness.json");
  const nextAction = readinessNextAction(runId);
  if (!(await pathExists(target))) {
    return { nextAction, status: "missing" };
  }
  try {
    return summarizeReadinessArtifact(await readJsonFile<unknown>(target), runId, currentState);
  } catch {
    return {
      message: "diagnostics/readiness.json could not be parsed.",
      nextAction,
      status: "invalid",
    };
  }
}

/**
 * Formats a readiness summary for display.
 *
 * @param readiness - The readiness summary to format
 * @returns The formatted display lines
 */
export function formatStatusReadiness(readiness: StatusReadinessSummary): string[] {
  switch (readiness.status) {
    case "missing":
      return ["Readiness: not generated", `Readiness next action: ${readiness.nextAction}`];
    case "invalid":
    case "stale":
      return [
        `Readiness: ${readiness.status} (${readiness.message})`,
        `Readiness next action: ${readiness.nextAction}`,
      ];
    default:
      return [
        `Readiness: ${readiness.status} (${readiness.checkCount} checks, ${readiness.blockCount} block, ${readiness.warnCount} warn)`,
        ...formatReadinessAttention(readiness.attention),
      ];
  }
}

/**
 * Summarizes a readiness artifact for a run.
 *
 * @param artifact - Parsed readiness artifact content.
 * @param runId - The run identifier used to validate and materialize the artifact.
 * @param currentState - The current run state used to validate the artifact.
 * @returns A readiness summary, or an invalid or stale status when the artifact cannot be summarized.
 */
function summarizeReadinessArtifact(
  artifact: unknown,
  runId: string,
  currentState: RunState,
): StatusReadinessSummary {
  const nextAction = readinessNextAction(runId);
  if (!isRecord(artifact) || !Array.isArray(artifact.checks)) {
    return {
      message: "diagnostics/readiness.json is missing a checks array.",
      nextAction,
      status: "invalid",
    };
  }
  if (artifact.runId !== runId) {
    return {
      message: "diagnostics/readiness.json belongs to a different run.",
      nextAction,
      status: "stale",
    };
  }
  if (artifact.currentState !== currentState) {
    return {
      message: `diagnostics/readiness.json was generated for ${String(
        artifact.currentState,
      )}, but the run is ${currentState}.`,
      nextAction,
      status: "stale",
    };
  }
  if (!artifact.checks.every(isPersistedReadinessCheck)) {
    return {
      message: "diagnostics/readiness.json contains an invalid check.",
      nextAction,
      status: "invalid",
    };
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

/**
 * Formats readiness attention entries for display.
 *
 * @param attention - The attention entries to format.
 * @returns Formatted display lines, or an empty array when there are no attention entries.
 */
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

/**
 * Identifies readiness checks that require attention.
 *
 * @returns `true` if the check status is `"block"` or `"warn"`, `false` otherwise.
 */
function isAttentionCheck(
  check: PersistedReadinessCheck,
): check is PersistedReadinessCheck & { status: "block" | "warn" } {
  return check.status === "block" || check.status === "warn";
}

/**
 * Determines whether a value matches the persisted readiness check shape.
 *
 * @param value - The value to inspect
 * @returns `true` if the value is a persisted readiness check, `false` otherwise.
 */
function isPersistedReadinessCheck(value: unknown): value is PersistedReadinessCheck {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    isReadinessCheckStatus(value.status) &&
    typeof value.message === "string" &&
    (value.nextAction === undefined || typeof value.nextAction === "string")
  );
}

/**
 * Determines whether a value is a readiness check status.
 *
 * @param value - The value to test.
 * @returns `true` if the value is `"pass"`, `"warn"`, or `"block"`, `false` otherwise.
 */
function isReadinessCheckStatus(value: unknown): value is ReadinessCheckStatus {
  return value === "pass" || value === "warn" || value === "block";
}

/**
 * Determines whether a value is a plain object record.
 *
 * @param value - The value to check
 * @returns `true` if `value` is a non-null object, `false` otherwise.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Replaces the run ID placeholder in a command string.
 *
 * @param command - The command template to update.
 * @param runId - The run ID to insert.
 * @returns The command with every `<run_id>` placeholder replaced, or `undefined` when `command` is `undefined`.
 */
function materializeRunCommand(command: string | undefined, runId: string): string | undefined {
  return command?.replaceAll("<run_id>", runId);
}

/**
 * Builds the command for rerunning readiness checks for a run.
 *
 * @param runId - The run identifier to include in the command
 * @returns The readiness CLI command for the given run
 */
function readinessNextAction(runId: string): string {
  return `pnpm producer readiness --run ${runId}`;
}
