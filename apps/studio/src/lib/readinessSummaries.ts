import { readFile } from "node:fs/promises";
import path from "node:path";

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

export async function readStudioReadinessSnapshot(
  root: string,
  runId: string,
): Promise<{ malformed: boolean; snapshot: ReadinessSnapshot | null }> {
  try {
    const file = path.join(root, "runs", runId, "diagnostics", "readiness.json");
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
  if (checks.some((check) => check === null)) {
    return invalidReadiness(nextAction, "Readiness diagnostics contain an invalid check.");
  }
  return {
    checks: checks.filter((check): check is StudioReadinessCheck => check !== null),
    message: readiness.passed ? "Readiness passed." : "Readiness has not passed yet.",
    passed: readiness.passed,
    status: readiness.passed ? "passed" : "blocked",
  };
}

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

function isReadinessStatus(value: unknown): value is StudioReadinessCheck["status"] {
  return value === "block" || value === "pass" || value === "warn";
}

function invalidReadiness(nextAction: string, message: string): StudioReadinessSummary {
  return { checks: [], message, nextAction, passed: null, status: "invalid" };
}

function readinessNextAction(runId: string): string {
  return `pnpm producer readiness --run ${runId}`;
}
