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

export type EvidenceStatusValidationContext = Readonly<{
  currentArtifacts: readonly string[];
  currentState: string;
  currentTtsConfigurationDigest: string | null;
  currentVoiceAuditionPathRevision: string;
  currentVoiceAuditionRequired: boolean | null;
  currentVoiceAuditionRevision: string | null;
  runId: string;
}>;

/**
 * Validates a persisted evidence bundle snapshot for status and Studio reads.
 *
 * @param evidence - Parsed evidence data to validate.
 * @param context - Current run, artifact, TTS, and voice-audition identity.
 * @param nowMs - Time used to enforce catalog freshness.
 * @returns A present, stale, or invalid evidence classification.
 */
export function validateEvidenceStatusSnapshot(
  evidence: unknown,
  context: EvidenceStatusValidationContext,
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
  const identityMismatch = validateSnapshotIdentity(parsed.data, context);
  if (identityMismatch) return identityMismatch;
  const ttsMismatch = validateTtsContext(parsed.data, context);
  if (ttsMismatch) return ttsMismatch;
  const requiresVoiceAudition = requiresCurrentVoiceAudition(
    parsed.data,
    context.currentState,
    context.currentVoiceAuditionRequired,
  );
  const voiceMismatch = validateVoiceAuditionContext(
    parsed.data,
    context,
    requiresVoiceAudition,
    nowMs,
  );
  if (voiceMismatch) return voiceMismatch;
  return { evidence: parsed.data, kind: "present" };
}

function validateSnapshotIdentity(
  evidence: PersistedEvidenceStatus,
  context: EvidenceStatusValidationContext,
): EvidenceStatusValidationResult | null {
  if (evidence.runId !== context.runId) {
    return { kind: "stale", message: "evidence_bundle.json belongs to a different run." };
  }
  return evidence.currentState === context.currentState
    ? null
    : {
        kind: "stale",
        message: `evidence_bundle.json was generated for ${String(
          evidence.currentState,
        )}, but the run is ${context.currentState}.`,
      };
}

function validateTtsContext(
  evidence: PersistedEvidenceStatus,
  context: EvidenceStatusValidationContext,
): EvidenceStatusValidationResult | null {
  if (!requiresCurrentTtsConfiguration(evidence, context.currentState)) return null;
  if (
    context.currentTtsConfigurationDigest === null ||
    evidence.ttsConfigurationDigest !== context.currentTtsConfigurationDigest
  ) {
    return {
      kind: "stale",
      message: "evidence_bundle.json does not match current TTS configuration.",
    };
  }
  return context.currentVoiceAuditionRequired !== null &&
    (evidence.voiceSelection.status !== "not-required") === context.currentVoiceAuditionRequired
    ? null
    : {
        kind: "stale",
        message:
          "evidence_bundle.json voice selection requirement does not match current TTS provider.",
      };
}

function validateVoiceAuditionContext(
  evidence: PersistedEvidenceStatus,
  context: EvidenceStatusValidationContext,
  required: boolean,
  nowMs: number,
): EvidenceStatusValidationResult | null {
  if (!required) return null;
  if (evidence.voiceAuditionPathRevision !== context.currentVoiceAuditionPathRevision) {
    return {
      kind: "stale",
      message: "evidence_bundle.json does not match current voice audition evidence.",
    };
  }
  if (evidence.voiceSelection.status !== "current") return null;
  if (evidence.voiceAuditionRevision !== context.currentVoiceAuditionRevision) {
    return {
      kind: "stale",
      message: "evidence_bundle.json does not match current selected voice evidence.",
    };
  }
  if (!context.currentArtifacts.includes(evidence.voiceSelection.path)) {
    return {
      kind: "stale",
      message: "evidence_bundle.json references an unregistered voice selection.",
    };
  }
  return Date.parse(evidence.voiceSelection.validUntil) > nowMs
    ? null
    : { kind: "stale", message: "evidence_bundle.json voice catalog freshness has expired." };
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
