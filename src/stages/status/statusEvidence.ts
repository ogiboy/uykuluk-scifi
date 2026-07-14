import { readRegisteredArtifactBytesAtProjectRoot } from "../../core/artifactRevision.js";
import type { RunState } from "../../core/state.js";
import {
  EvidenceStatusCurrentContextError,
  readEvidenceStatusCurrentContext,
} from "./statusEvidenceCurrentContext.js";
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
  let evidence: unknown;
  try {
    const bytes = await readRegisteredArtifactBytesAtProjectRoot(
      process.cwd(),
      { runId, artifacts: [...currentArtifacts] },
      "evidence_bundle.json",
    );
    if (!bytes) {
      return { kind: "missing" };
    }
    evidence = JSON.parse(bytes.toString("utf8")) as unknown;
  } catch (error) {
    return evidenceReadFailure(error);
  }
  let currentContext: Awaited<ReturnType<typeof readEvidenceStatusCurrentContext>>;
  try {
    currentContext = await readEvidenceStatusCurrentContext({
      evidence,
      runId,
      currentState,
      currentArtifacts,
      projectRoot: process.cwd(),
    });
  } catch (error) {
    return { kind: "invalid", message: evidenceContextFailureMessage(error) };
  }
  return validateEvidenceStatus(
    evidence,
    runId,
    currentState,
    currentArtifacts,
    currentContext.currentVoiceAuditionPathRevision,
    currentContext.currentVoiceAuditionRevision,
    currentContext.currentTtsConfigurationDigest,
    currentContext.currentVoiceAuditionRequired,
  );
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
  runId: string,
  currentState: string,
  currentArtifacts: readonly string[],
  currentVoiceAuditionPathRevision: string,
  currentVoiceAuditionRevision: string | null,
  currentTtsConfigurationDigest: string | null,
  currentVoiceAuditionRequired: boolean | null,
): EvidenceReadResult {
  return validateEvidenceStatusSnapshot(
    evidence,
    runId,
    currentState,
    currentArtifacts,
    currentVoiceAuditionPathRevision,
    currentVoiceAuditionRevision,
    currentTtsConfigurationDigest,
    currentVoiceAuditionRequired,
  );
}

function evidenceContextFailureMessage(error: unknown): string {
  return error instanceof EvidenceStatusCurrentContextError && error.source === "tts-configuration"
    ? "evidence_bundle.json could not be validated against current TTS configuration."
    : "evidence_bundle.json could not be validated against selected voice evidence.";
}

function evidenceReadFailure(error: unknown): EvidenceReadResult {
  if ((error as NodeJS.ErrnoException).code === "ENOENT") {
    return { kind: "missing" };
  }
  return error instanceof SyntaxError
    ? { kind: "invalid", message: "evidence_bundle.json could not be parsed." }
    : { kind: "invalid", message: "evidence_bundle.json could not be read safely." };
}
