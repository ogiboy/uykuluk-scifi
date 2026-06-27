import { artifactPath } from "../core/artifacts.js";
import type { RunState } from "../core/state.js";
import { pathExists } from "../utils/fs.js";
import { readJsonFile } from "../utils/json.js";
import {
  validateEvidenceStatusSnapshot,
  type EvidenceStatusValidationResult,
} from "./statusEvidenceSchema.js";

export type EvidenceReadResult = EvidenceStatusValidationResult;

/**
 * Reads and validates the evidence bundle for a run.
 *
 * @param runId - The run identifier used to locate the artifact
 * @param currentState - The current run state used to verify the artifact
 * @returns The evidence read result for the artifact
 */
export async function readEvidenceStatus(
  runId: string,
  currentState: RunState,
): Promise<EvidenceReadResult> {
  const target = artifactPath(runId, "evidence_bundle.json");
  if (!(await pathExists(target))) {
    return { kind: "missing" };
  }
  try {
    return validateEvidenceStatus(await readJsonFile<unknown>(target), runId, currentState);
  } catch {
    return { kind: "invalid", message: "evidence_bundle.json could not be parsed." };
  }
}

/**
 * Validates parsed evidence against the expected run and state.
 *
 * @param evidence - Parsed evidence data to validate
 * @param runId - Expected run identifier
 * @param currentState - Expected run state
 * @returns `{ kind: "present" }` when the evidence matches, `{ kind: "stale" }` when it belongs to a different run or state, or `{ kind: "invalid" }` when the value is not an object
 */
export function validateEvidenceStatus(
  evidence: unknown,
  runId: string,
  currentState: string,
): EvidenceReadResult {
  return validateEvidenceStatusSnapshot(evidence, runId, currentState);
}
