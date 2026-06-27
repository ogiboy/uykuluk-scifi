import { artifactPath } from "../core/artifacts.js";
import type { RunState } from "../core/state.js";
import { pathExists } from "../utils/fs.js";
import { readJsonFile } from "../utils/json.js";
import type { EvidenceStatus } from "./statusMedia.js";

export type EvidenceReadResult =
  | { evidence: EvidenceStatus; kind: "present" }
  | { kind: "missing" }
  | { kind: "invalid"; message: string }
  | { kind: "stale"; message: string };

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
    return validateEvidenceStatus(await readJsonFile<EvidenceStatus>(target), runId, currentState);
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
function validateEvidenceStatus(
  evidence: EvidenceStatus,
  runId: string,
  currentState: RunState,
): EvidenceReadResult {
  if (!evidence || typeof evidence !== "object") {
    return { kind: "invalid", message: "evidence_bundle.json is not an object." };
  }
  if (evidence.runId !== runId) {
    return { kind: "stale", message: "evidence_bundle.json belongs to a different run." };
  }
  if (evidence.currentState !== currentState) {
    return {
      kind: "stale",
      message: `evidence_bundle.json was generated for ${String(
        evidence.currentState,
      )}, but the run is ${currentState}.`,
    };
  }
  return { evidence, kind: "present" };
}
