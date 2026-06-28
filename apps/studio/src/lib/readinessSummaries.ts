import { readFile } from "node:fs/promises";
import { isValidRunId } from "../../../../src/core/runId";
import { studioRunFilePath } from "./runFilePaths";

export type StudioReadinessCheck = {
  message: string;
  name: string;
  nextAction?: string;
  status: "block" | "pass" | "warn";
};

export type ReadinessSnapshot = {
  currentState?: unknown;
  checks?: unknown[];
  passed?: unknown;
  runId?: unknown;
};

export type StudioReadinessSummary = {
  checks: StudioReadinessCheck[];
  message: string;
  nextAction?: string;
  passed: boolean | null;
  status: "blocked" | "invalid" | "missing" | "passed" | "stale";
};

/**
 * Reads a readiness snapshot from disk.
 *
 * @param root - The workspace root directory
 * @param runId - The readiness run identifier
 * @returns An object containing the parsed snapshot and whether it could be parsed
 */
export async function readStudioReadinessSnapshot(
  root: string,
  runId: string,
): Promise<{ malformed: boolean; snapshot: ReadinessSnapshot | null }> {
  if (!isValidRunId(runId)) {
    return { malformed: true, snapshot: null };
  }
  try {
    const file = studioRunFilePath(root, runId, "diagnostics/readiness.json");
    if (!file) {
      return { malformed: true, snapshot: null };
    }
    return {
      malformed: false,
      snapshot: JSON.parse(await readFile(file, "utf8")) as ReadinessSnapshot,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { malformed: false, snapshot: null };
    }
    return { malformed: true, snapshot: null };
  }
}

/**
 * Summarizes a readiness snapshot for the current run and state.
 *
 * Produces a normalized readiness summary, marking the result as missing, stale, invalid, passed, or blocked depending on the snapshot contents and validation outcome.
 *
 * @param readiness - The parsed readiness snapshot, or `null` when the file is missing.
 * @param runId - The run identifier used to validate the snapshot and build the next action.
 * @param state - The current run state used to validate snapshot freshness.
 * @param malformed - Whether the snapshot file could not be parsed.
 * @returns The summarized readiness status and checks.
 */
export function summarizeReadinessSnapshot(
  readiness: ReadinessSnapshot | null,
  runId: string,
  state: string,
  malformed = false,
): StudioReadinessSummary {
  const nextAction = readinessNextAction(runId);
  if (malformed) {
    return invalidReadiness(nextAction, "Readiness diagnostics could not be parsed.");
  }
  if (!readiness) {
    return {
      checks: [],
      message: "Readiness diagnostics have not been generated.",
      nextAction,
      passed: null,
      status: "missing",
    };
  }
  if (readiness.runId !== runId) {
    return {
      checks: [],
      message: "Readiness diagnostics belong to a different run.",
      nextAction,
      passed: null,
      status: "stale",
    };
  }
  if (readiness.currentState !== state) {
    return {
      checks: [],
      message: `Readiness diagnostics were generated for ${String(
        readiness.currentState,
      )}, but the run is ${state}.`,
      nextAction,
      passed: null,
      status: "stale",
    };
  }
  if (typeof readiness.passed !== "boolean" || !Array.isArray(readiness.checks)) {
    return invalidReadiness(nextAction, "Readiness diagnostics are missing required fields.");
  }
  const checks = readiness.checks.map((check) => summarizeReadinessCheck(check, runId));
  if (checks.includes(null)) {
    return invalidReadiness(nextAction, "Readiness diagnostics contain an invalid check.");
  }
  const validChecks = checks.filter((check): check is StudioReadinessCheck => check !== null);
  const passed = readiness.passed && !validChecks.some((check) => check.status === "block");
  return {
    checks: validChecks,
    message: passed ? "Readiness passed." : "Readiness has not passed yet.",
    passed,
    status: passed ? "passed" : "blocked",
  };
}

/**
 * Validates and normalizes a readiness check.
 *
 * @param check - The raw readiness check value.
 * @param runId - The run identifier used to rewrite `nextAction` placeholders.
 * @returns The normalized readiness check, or `null` when the input is invalid.
 */
function summarizeReadinessCheck(check: unknown, runId: string): StudioReadinessCheck | null {
  if (!check || typeof check !== "object") {
    return null;
  }
  const name = "name" in check ? check.name : undefined;
  const status = "status" in check ? check.status : undefined;
  const message = "message" in check ? check.message : undefined;
  const nextAction = "nextAction" in check ? check.nextAction : undefined;
  return typeof name === "string" && isReadinessStatus(status) && typeof message === "string"
    ? readinessCheck({ message, name, nextAction, runId, status })
    : null;
}

/**
 * Builds a readiness check and substitutes the run ID in its next action.
 *
 * @param input - The normalized check data to convert.
 * @returns The readiness check, including `nextAction` when a string is provided.
 */
function readinessCheck(input: {
  message: string;
  name: string;
  nextAction: unknown;
  runId: string;
  status: StudioReadinessCheck["status"];
}): StudioReadinessCheck {
  return typeof input.nextAction === "string"
    ? {
        message: input.message,
        name: input.name,
        nextAction: input.nextAction.replaceAll("<run_id>", input.runId),
        status: input.status,
      }
    : {
        message: input.message,
        name: input.name,
        status: input.status,
      };
}

/**
 * Determines whether a value is a valid readiness status.
 *
 * @param value - The value to check.
 * @returns `true` if the value is `"block"`, `"pass"`, or `"warn"`, `false` otherwise.
 */
function isReadinessStatus(value: unknown): value is StudioReadinessCheck["status"] {
  return value === "block" || value === "pass" || value === "warn";
}

/**
 * Creates an invalid readiness summary.
 *
 * @param nextAction - The command to rerun readiness production
 * @param message - The validation message to report
 * @returns A summary with no checks, `passed` set to `null`, and status `"invalid"`
 */
function invalidReadiness(nextAction: string, message: string): StudioReadinessSummary {
  return { checks: [], message, nextAction, passed: null, status: "invalid" };
}

/**
 * Builds the command used to rerun readiness production for a run.
 *
 * @param runId - The run identifier to include in the command
 * @returns The readiness production command for `runId`
 */
function readinessNextAction(runId: string): string {
  return `pnpm producer readiness --run ${runId}`;
}
