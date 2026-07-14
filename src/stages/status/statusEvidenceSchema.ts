import type { SelectedVoiceAuditionArtifacts } from "../voice/catalog/voiceAuditionRevision.js";
import {
  persistedEvidenceStatusSchema,
  type PersistedEvidenceStatus,
} from "./statusEvidenceContracts.js";

type EvidenceStatus = { [key: string]: unknown };

export type EvidenceStatusValidationResult =
  | { evidence: EvidenceStatus; kind: "present" }
  | { kind: "missing" }
  | { kind: "invalid"; message: string }
  | { kind: "stale"; message: string };

/**
 * Validates a persisted evidence bundle snapshot for status and Studio reads.
 *
 * @param evidence - Parsed evidence data to validate.
 * @param runId - Expected run identifier.
 * @param currentState - Expected run state.
 * @param currentArtifacts - Current artifact registry used to verify the selected voice path.
 * @param currentVoiceAuditionPathRevision - Current ordered audition path revision.
 * @param currentVoiceAuditionRevision - Exact current selected-chain revision, when required.
 * @param currentTtsConfigurationDigest - Current non-secret TTS configuration digest.
 * @param currentVoiceAuditionRequired - Whether current live TTS config requires ElevenLabs audition.
 * @param nowMs - Time used to enforce catalog freshness.
 * @returns A present, stale, or invalid evidence classification.
 */
export function validateEvidenceStatusSnapshot(
  evidence: unknown,
  runId: string,
  currentState: string,
  currentArtifacts: readonly string[],
  currentVoiceAuditionPathRevision: string,
  currentVoiceAuditionRevision: string | null,
  currentTtsConfigurationDigest: string | null,
  currentVoiceAuditionRequired: boolean | null,
  nowMs: number = Date.now(),
): EvidenceStatusValidationResult {
  if (isLegacyEvidenceSnapshot(evidence)) {
    return {
      kind: "invalid",
      message: "evidence_bundle.json uses a legacy schema and must be regenerated.",
    };
  }
  const parsed = persistedEvidenceStatusSchema.safeParse(evidence);
  if (!parsed.success) {
    return { kind: "invalid", message: "evidence_bundle.json is missing required fields." };
  }
  if (parsed.data.runId !== runId) {
    return { kind: "stale", message: "evidence_bundle.json belongs to a different run." };
  }
  if (parsed.data.currentState !== currentState) {
    return {
      kind: "stale",
      message: `evidence_bundle.json was generated for ${String(
        parsed.data.currentState,
      )}, but the run is ${currentState}.`,
    };
  }
  if (
    requiresCurrentTtsConfiguration(parsed.data, currentState) &&
    (currentTtsConfigurationDigest === null ||
      parsed.data.ttsConfigurationDigest !== currentTtsConfigurationDigest)
  ) {
    return {
      kind: "stale",
      message: "evidence_bundle.json does not match current TTS configuration.",
    };
  }
  const requiresVoiceAudition = requiresCurrentVoiceAudition(
    parsed.data,
    currentState,
    currentVoiceAuditionRequired,
  );
  if (
    requiresCurrentTtsConfiguration(parsed.data, currentState) &&
    (currentVoiceAuditionRequired === null ||
      (parsed.data.voiceSelection.status !== "not-required") !== currentVoiceAuditionRequired)
  ) {
    return {
      kind: "stale",
      message:
        "evidence_bundle.json voice selection requirement does not match current TTS provider.",
    };
  }
  if (requiresVoiceAudition) {
    if (parsed.data.voiceAuditionPathRevision !== currentVoiceAuditionPathRevision) {
      return {
        kind: "stale",
        message: "evidence_bundle.json does not match current voice audition evidence.",
      };
    }
    if (
      parsed.data.voiceSelection.status === "current" &&
      parsed.data.voiceAuditionRevision !== currentVoiceAuditionRevision
    ) {
      return {
        kind: "stale",
        message: "evidence_bundle.json does not match current selected voice evidence.",
      };
    }
  }
  if (requiresVoiceAudition && parsed.data.voiceSelection.status === "current") {
    if (!currentArtifacts.includes(parsed.data.voiceSelection.path)) {
      return {
        kind: "stale",
        message: "evidence_bundle.json references an unregistered voice selection.",
      };
    }
    if (Date.parse(parsed.data.voiceSelection.validUntil) <= nowMs) {
      return {
        kind: "stale",
        message: "evidence_bundle.json voice catalog freshness has expired.",
      };
    }
  }
  return { evidence: parsed.data, kind: "present" };
}

export type EvidenceVoiceAuditionBinding = {
  artifacts: SelectedVoiceAuditionArtifacts;
  expectedRevision: string;
  expectedSelectionDigest: string;
  expectedValidUntil: string;
};

/** Returns the exact selected audition binding while evidence is still gating a voice operation. */
export function evidenceVoiceAuditionBinding(
  evidence: unknown,
  currentState: string,
): EvidenceVoiceAuditionBinding | null {
  const parsed = persistedEvidenceStatusSchema.safeParse(evidence);
  if (
    !parsed.success ||
    !requiresCurrentVoiceAudition(parsed.data, currentState) ||
    parsed.data.voiceSelection.status !== "current" ||
    parsed.data.voiceAuditionRevision === null
  ) {
    return null;
  }
  return {
    artifacts: parsed.data.voiceSelection.artifacts,
    expectedRevision: parsed.data.voiceAuditionRevision,
    expectedSelectionDigest: parsed.data.voiceSelection.digest,
    expectedValidUntil: parsed.data.voiceSelection.validUntil,
  };
}

/** Returns whether live non-secret TTS configuration is needed to validate this snapshot. */
export function evidenceRequiresCurrentTtsConfiguration(
  evidence: unknown,
  currentState: string,
): boolean {
  const parsed = persistedEvidenceStatusSchema.safeParse(evidence);
  return parsed.success && requiresCurrentTtsConfiguration(parsed.data, currentState);
}

/** Returns the persisted non-secret TTS configuration digest for a schema-current snapshot. */
export function evidenceTtsConfigurationDigest(evidence: unknown): string | null {
  const parsed = persistedEvidenceStatusSchema.safeParse(evidence);
  return parsed.success ? parsed.data.ttsConfigurationDigest : null;
}

/** Returns whether a schema-current snapshot already matches the requested run identity. */
export function evidenceStatusIdentityMatches(
  evidence: unknown,
  runId: string,
  currentState: string,
): boolean {
  const parsed = persistedEvidenceStatusSchema.safeParse(evidence);
  return parsed.success && parsed.data.runId === runId && parsed.data.currentState === currentState;
}

function requiresCurrentVoiceAudition(
  evidence: PersistedEvidenceStatus,
  currentState: string,
  currentVoiceAuditionRequired?: boolean | null,
): boolean {
  if (currentVoiceAuditionRequired !== undefined) {
    return (
      currentVoiceAuditionRequired === true &&
      requiresCurrentTtsConfiguration(evidence, currentState)
    );
  }
  if (evidence.voiceSelection.status === "not-required") return false;
  return requiresCurrentTtsConfiguration(evidence, currentState);
}

function requiresCurrentTtsConfiguration(
  evidence: PersistedEvidenceStatus,
  currentState: string,
): boolean {
  if (currentState === "READY_FOR_MANUAL_PRODUCTION") {
    return evidence.voiceoverAudio.status !== "pass";
  }
  return (
    currentState === "PRODUCTION_PACKAGE_GENERATED" ||
    currentState === "COST_ESTIMATED" ||
    currentState === "PAID_GENERATION_COST_APPROVED"
  );
}

function isLegacyEvidenceSnapshot(evidence: unknown): boolean {
  return (
    typeof evidence === "object" &&
    evidence !== null &&
    !Array.isArray(evidence) &&
    !("schemaVersion" in evidence)
  );
}
