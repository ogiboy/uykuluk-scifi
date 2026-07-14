import { isValidRunId } from "../../../../../src/core/runId";
import {
  materializeRunCommand,
  staticEvidenceNextCommand,
} from "../../../../../src/stages/evidence/evidenceNextCommand";
import { readEvidenceStatusSnapshot } from "../../../../../src/stages/status/statusEvidenceCurrentContext";
import { validateEvidenceStatusSnapshot } from "../../../../../src/stages/status/statusEvidenceSchema";
import type { EvidenceStatus } from "../../../../../src/stages/status/statusMediaSummary";

export type StudioEvidenceSummary = {
  message: string;
  nextAction?: string;
  snapshot: EvidenceStatus | null;
  status: "available" | "invalid" | "missing" | "stale";
};

/**
 * Reads and validates the evidence bundle for a run.
 *
 * @param root - The root directory containing run data
 * @param runId - The run identifier
 * @param state - The expected generation state
 * @param artifacts - Registered run artifacts used to detect same-state evidence drift
 * @returns A summary of the evidence bundle's status and contents
 */
export async function readStudioEvidenceSummary(
  root: string,
  runId: string,
  state: string,
  artifacts: readonly string[],
): Promise<StudioEvidenceSummary> {
  let validatedRunId: string;
  try {
    validatedRunId = validStudioRunId(runId);
  } catch {
    return invalidEvidence(runId, "Evidence bundle path is invalid.");
  }
  const loaded = await readEvidenceStatusSnapshot({
    runId: validatedRunId,
    currentState: state,
    currentArtifacts: artifacts,
    projectRoot: root,
  });
  if (loaded.kind === "missing") {
    return {
      message: "Evidence bundle has not been generated.",
      nextAction: evidenceNextAction(runId),
      snapshot: null,
      status: "missing",
    };
  }
  if (loaded.kind === "invalid") {
    return invalidEvidence(runId, studioEvidenceReadFailureMessage(loaded.source));
  }
  return summarizeEvidenceSnapshot(
    loaded.evidence,
    validatedRunId,
    state,
    artifacts,
    loaded.currentContext.currentVoiceAuditionPathRevision,
    loaded.currentContext.currentVoiceAuditionRevision,
    loaded.currentContext.currentTtsConfigurationDigest,
    loaded.currentContext.currentVoiceAuditionRequired,
  );
}

function studioEvidenceReadFailureMessage(
  source: "parse" | "read" | "tts-configuration" | "voice-audition",
): string {
  if (source === "parse") return "Evidence bundle could not be parsed.";
  if (source === "read") return "Evidence bundle could not be read safely.";
  return source === "tts-configuration"
    ? "Evidence bundle could not be validated against current TTS configuration."
    : "Evidence bundle could not be validated against selected voice evidence.";
}

function validStudioRunId(runId: string): string {
  if (!isValidRunId(runId)) {
    throw new Error("Invalid run id.");
  }
  return runId;
}

/**
 * Determines the next recommended command for a studio evidence summary.
 *
 * @param evidence - The summarized evidence bundle
 * @param state - The current run state
 * @param runId - The current run identifier
 * @returns The next recommended command, or `null` if none is available
 */
export function evidenceNextRecommendedCommand(
  evidence: StudioEvidenceSummary,
  state: string,
  runId: string,
): string | null {
  if (evidence.status === "missing") {
    return materializeStaticNextCommand(state, runId) ?? evidence.nextAction ?? null;
  }
  if (evidence.status === "invalid" || evidence.status === "stale") {
    return evidence.nextAction ?? null;
  }
  return typeof evidence.snapshot?.nextRecommendedCommand === "string"
    ? materializeRunCommand(evidence.snapshot.nextRecommendedCommand, runId)
    : materializeStaticNextCommand(state, runId);
}

/**
 * Validates an evidence bundle snapshot and classifies it as available, stale, or invalid.
 *
 * @param evidence - Parsed evidence bundle content.
 * @param runId - The run identifier the snapshot must belong to.
 * @param state - The current run state the snapshot must match.
 * @param artifacts - Registered run artifacts the snapshot must match.
 * @param currentVoiceAuditionPathRevision - Ordered registry revision of audition inputs.
 * @param currentVoiceAuditionRevision - Exact byte revision of the selected audition chain.
 * @param currentTtsConfigurationDigest - Current non-secret TTS configuration digest.
 * @param currentVoiceAuditionRequired - Whether live TTS config requires ElevenLabs audition.
 * @returns A current, stale, or invalid evidence summary.
 */
function summarizeEvidenceSnapshot(
  evidence: unknown,
  runId: string,
  state: string,
  artifacts: readonly string[],
  currentVoiceAuditionPathRevision: string,
  currentVoiceAuditionRevision: string | null,
  currentTtsConfigurationDigest: string | null,
  currentVoiceAuditionRequired: boolean | null,
): StudioEvidenceSummary {
  const result = validateEvidenceStatusSnapshot(
    evidence,
    runId,
    state,
    artifacts,
    currentVoiceAuditionPathRevision,
    currentVoiceAuditionRevision,
    currentTtsConfigurationDigest,
    currentVoiceAuditionRequired,
  );
  if (result.kind === "invalid") {
    return invalidEvidence(runId, studioEvidenceMessage(result.message));
  }
  if (result.kind === "stale") {
    return staleEvidence(runId, studioEvidenceMessage(result.message));
  }
  if (result.kind === "missing") {
    return invalidEvidence(runId, "Evidence bundle has not been generated.");
  }
  return { message: "Evidence bundle is current.", snapshot: result.evidence, status: "available" };
}

function studioEvidenceMessage(message: string): string {
  return message.replaceAll("evidence_bundle.json", "Evidence bundle");
}

/**
 * Creates an invalid evidence summary.
 *
 * @param runId - The run identifier used to build the next action command
 * @param message - The summary message
 * @returns An invalid evidence summary with no snapshot
 */
function invalidEvidence(runId: string, message: string): StudioEvidenceSummary {
  return { message, nextAction: evidenceNextAction(runId), snapshot: null, status: "invalid" };
}

/**
 * Creates a stale evidence summary.
 *
 * @param runId - The run identifier used to build the next action
 * @param message - The summary message
 * @returns A stale evidence summary with no snapshot and a next action for the run
 */
function staleEvidence(runId: string, message: string): StudioEvidenceSummary {
  return { message, nextAction: evidenceNextAction(runId), snapshot: null, status: "stale" };
}

/**
 * Builds the command for generating evidence for a run.
 *
 * @param runId - The run identifier
 * @returns The command string for generating evidence for `runId`
 */
function evidenceNextAction(runId: string): string {
  return `pnpm producer evidence --run ${runId}`;
}

/**
 * Builds the next command for the current state and run.
 *
 * @param state - The current studio state
 * @param runId - The run identifier to include in the command
 * @returns The materialized command, or `null` if no state-based command is available
 */
function materializeStaticNextCommand(state: string, runId: string): string | null {
  const command = staticEvidenceNextCommand(state);
  return command ? materializeRunCommand(command, runId) : null;
}
