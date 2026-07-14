import { loadConfigAtProjectRoot } from "../../config/config.js";
import type { ProducerConfig } from "../../config/schema.js";
import {
  ttsConfigurationDigest,
  validatedVoiceAuditionArtifactRevision,
  voiceAuditionPathRevision,
} from "../voice/catalog/voiceAuditionRevision.js";
import {
  evidenceRequiresCurrentTtsConfiguration,
  evidenceStatusIdentityMatches,
  evidenceTtsConfigurationDigest,
  evidenceVoiceAuditionBinding,
} from "./statusEvidenceSchema.js";

export type EvidenceStatusCurrentContext = {
  currentTtsConfigurationDigest: string | null;
  currentVoiceAuditionRequired: boolean | null;
  currentVoiceAuditionPathRevision: string;
  currentVoiceAuditionRevision: string | null;
};

export class EvidenceStatusCurrentContextError extends Error {
  constructor(public readonly source: "tts-configuration" | "voice-audition") {
    super(`Evidence status context failed: ${source}.`);
    this.name = "EvidenceStatusCurrentContextError";
  }
}

/**
 * Builds the shared root-aware freshness context used by CLI and Studio evidence readers.
 *
 * Exact preview audio bytes are read only for the selected four-artifact chain and only while the
 * evidence state can still lead to a new voice operation.
 */
export async function readEvidenceStatusCurrentContext(input: {
  evidence: unknown;
  runId: string;
  currentState: string;
  currentArtifacts: readonly string[];
  projectRoot: string;
}): Promise<EvidenceStatusCurrentContext> {
  if (!evidenceStatusIdentityMatches(input.evidence, input.runId, input.currentState)) {
    return {
      currentTtsConfigurationDigest: null,
      currentVoiceAuditionRequired: null,
      currentVoiceAuditionPathRevision: voiceAuditionPathRevision(input.currentArtifacts),
      currentVoiceAuditionRevision: null,
    };
  }
  let config: ProducerConfig | null = null;
  if (evidenceRequiresCurrentTtsConfiguration(input.evidence, input.currentState)) {
    try {
      config = await loadConfigAtProjectRoot(input.projectRoot);
    } catch {
      throw new EvidenceStatusCurrentContextError("tts-configuration");
    }
  }
  const currentTtsConfigurationDigest = config
    ? ttsConfigurationDigest(config.providers.tts)
    : null;
  const currentVoiceAuditionRequired = config
    ? config.providers.tts.enabled && config.providers.tts.mode === "elevenlabs"
    : null;
  const expectedTtsConfigurationDigest = evidenceTtsConfigurationDigest(input.evidence);
  if (
    currentTtsConfigurationDigest !== null &&
    expectedTtsConfigurationDigest !== null &&
    currentTtsConfigurationDigest !== expectedTtsConfigurationDigest
  ) {
    return {
      currentTtsConfigurationDigest,
      currentVoiceAuditionRequired,
      currentVoiceAuditionPathRevision: voiceAuditionPathRevision(input.currentArtifacts),
      currentVoiceAuditionRevision: null,
    };
  }
  const binding = currentVoiceAuditionRequired
    ? evidenceVoiceAuditionBinding(input.evidence, input.currentState)
    : null;
  let currentVoiceAuditionRevision: string | null = null;
  if (binding) {
    if (!config) {
      throw new EvidenceStatusCurrentContextError("tts-configuration");
    }
    try {
      currentVoiceAuditionRevision = await validatedVoiceAuditionArtifactRevision({
        projectRoot: input.projectRoot,
        run: { runId: input.runId, artifacts: [...input.currentArtifacts] },
        config,
        ...binding,
      });
    } catch {
      throw new EvidenceStatusCurrentContextError("voice-audition");
    }
  }
  return {
    currentTtsConfigurationDigest,
    currentVoiceAuditionRequired,
    currentVoiceAuditionPathRevision: voiceAuditionPathRevision(input.currentArtifacts),
    currentVoiceAuditionRevision,
  };
}
