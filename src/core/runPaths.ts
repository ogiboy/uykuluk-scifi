import path from "node:path";
import { SafeExitError } from "./errors";

const RUN_ID_PATTERN = /^run_[A-Za-z0-9][A-Za-z0-9_-]{0,123}$/;

export function isValidRunId(runId: string): boolean {
  return RUN_ID_PATTERN.test(runId);
}

export function validateRunId(runId: string): string {
  if (!isValidRunId(runId)) {
    throw new SafeExitError(
      "Invalid run id. Expected run_ followed by 1-124 ASCII letters, digits, underscores, or hyphens.",
    );
  }
  return runId;
}

export function runsDir(): string {
  return path.join(process.cwd(), "runs");
}

export function runDir(runId: string): string {
  return path.join(runsDir(), validateRunId(runId));
}

export function statePath(runId: string): string {
  return path.join(runDir(runId), "state.json");
}
