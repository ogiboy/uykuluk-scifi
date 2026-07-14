import type { RunState } from "../../core/state.js";
import { readEvidenceStatusSnapshot } from "./statusEvidenceCurrentContext.js";
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
 * @param currentArtifacts - Registered artifacts used to detect same-state evidence drift
 * @returns The evidence read result for the artifact
 */
export async function readEvidenceStatus(
  runId: string,
  currentState: RunState,
  currentArtifacts: readonly string[],
): Promise<EvidenceReadResult> {
  const snapshot = await readEvidenceStatusSnapshot({
    runId,
    currentState,
    currentArtifacts,
    projectRoot: process.cwd(),
  });
  if (snapshot.kind === "missing") {
    return snapshot;
  }
  if (snapshot.kind === "invalid") {
    return { kind: "invalid", message: evidenceReadFailureMessage(snapshot.source) };
  }
  return validateEvidenceStatus(snapshot.evidence, {
    runId,
    currentState,
    currentArtifacts,
    ...snapshot.currentContext,
  });
}

/**
 * Validates parsed evidence against the expected run and state.
 *
 * @param evidence - Parsed evidence data to validate
 * @param runId - Expected run identifier
 * @param currentState - Expected run state
 * @param currentArtifacts - Registered artifacts expected by the evidence snapshot
 * @param currentVoiceAuditionPathRevision - Ordered registry revision of audition inputs
 * @param currentVoiceAuditionRevision - Exact byte revision of the selected audition chain
 * @param currentTtsConfigurationDigest - Current non-secret TTS configuration digest
 * @param currentVoiceAuditionRequired - Whether live TTS config requires ElevenLabs audition
 * @returns `{ kind: "present" }` when the evidence matches, `{ kind: "stale" }` when it belongs to a different run or state, or `{ kind: "invalid" }` when the value is not an object
 */
export function validateEvidenceStatus(
  evidence: unknown,
  context: Parameters<typeof validateEvidenceStatusSnapshot>[1],
): EvidenceReadResult {
  return validateEvidenceStatusSnapshot(evidence, context);
}

function evidenceReadFailureMessage(
  source: "parse" | "read" | "tts-configuration" | "voice-audition",
): string {
  if (source === "parse") return "evidence_bundle.json could not be parsed.";
  if (source === "read") return "evidence_bundle.json could not be read safely.";
  return source === "tts-configuration"
    ? "evidence_bundle.json could not be validated against current TTS configuration."
    : "evidence_bundle.json could not be validated against selected voice evidence.";
}
