import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { loadConfig } from "../config/config.js";
import { artifactPath } from "../core/artifacts.js";
import { SafeExitError } from "../core/errors.js";
import { appendLedgerEvent } from "../core/ledger.js";
import { loadRun } from "../core/runStore.js";
import { requireApproval, requireState } from "../safeguards/approvalGuard.js";
import { verifyProductionPackage } from "./production/productionPackageIntegrity.js";
import { readRenderPlanEvidence } from "./renderPlan.js";
import type { HostedVoiceExecutionConfirmation } from "./voice/voiceExecutionConfirmation.js";
import type { VoiceExecutionMetadataProvider } from "./voice/voiceExecutionPreflight.js";
import { prepareVoiceExecution } from "./voice/voiceExecutionPreparation.js";
import { recoverCommittedVoiceExecution } from "./voice/voiceExecutionRecovery.js";
import { persistVoiceoverArtifacts } from "./voice/voiceoverArtifactPersistence.js";
import type { VoiceoverAudioMeta } from "./voice/voiceoverEvidence.js";
import { prepareVoiceoverText } from "./voice/voiceoverPreparation.js";
import { synthesizeVoiceover } from "./voice/voiceSynthesisExecution.js";

/**
 * Generates voiceover audio and persists its metadata and review artifacts for a run.
 *
 * @param runId - Identifier of the run to process
 * @param options - Optional execution metadata provider and lifecycle callbacks
 * @returns Metadata describing the generated voiceover audio and associated artifacts
 * @throws SafeExitError If the render plan is invalid, the source voiceover is empty, or local TTS is disabled
 */
export async function generateVoiceoverAudio(
  runId: string,
  options: {
    confirmation?: HostedVoiceExecutionConfirmation;
    metadataProvider?: VoiceExecutionMetadataProvider;
    afterSynthesis?: () => Promise<void>;
    afterResultCommitted?: () => Promise<void>;
  } = {},
): Promise<VoiceoverAudioMeta> {
  const config = await loadConfig();
  const run = await loadRun(runId);
  await requireState(run, "READY_FOR_MANUAL_PRODUCTION", "voice");
  await requireApproval(run, "script", "voice");
  await verifyProductionPackage(run);
  const renderPlan = await readRenderPlanEvidence(run);
  if (renderPlan.status !== "pass") {
    await appendLedgerEvent({
      runId: run.runId,
      type: "GUARD_BLOCKED",
      stage: "voice",
      message: `Voice/TTS requires a valid render plan: ${renderPlan.status}.`,
    });
    throw new SafeExitError("Voice/TTS requires a valid render plan before audio generation.");
  }

  const voiceover = await readFile(artifactPath(run.runId, "production/voiceover.txt"), "utf8");
  const source = {
    path: "production/voiceover.txt" as const,
    sha256: createHash("sha256").update(voiceover, "utf8").digest("hex"),
    wordCount: countWords(voiceover),
  };
  if (source.wordCount === 0) {
    throw new SafeExitError("Voice/TTS requires non-empty production/voiceover.txt.");
  }

  const recovered = await recoverCommittedVoiceExecution({ run, sourceDigest: source.sha256 });
  let mode: VoiceoverAudioMeta["mode"];
  let preparation: ReturnType<typeof prepareVoiceoverText>;
  let synthesis: Awaited<ReturnType<typeof synthesizeVoiceover>>;
  if (recovered) {
    mode = recovered.mode;
    preparation = recovered.preparation;
    synthesis = recovered.synthesis;
  } else {
    if (!config.providers.tts.enabled) {
      await appendLedgerEvent({
        runId: run.runId,
        type: "GUARD_BLOCKED",
        stage: "voice",
        message: "Voice/TTS is disabled until local TTS configuration is explicitly enabled.",
      });
      throw new SafeExitError(
        "Voice/TTS is disabled and requires explicit local TTS configuration.",
      );
    }
    preparation = prepareVoiceoverText({
      runId: run.runId,
      sourceText: voiceover,
      pronunciationReplacements: config.providers.tts.pronunciationReplacements,
    });
    const execution = await prepareVoiceExecution({
      runId: run.runId,
      config,
      preparedText: preparation.text,
      ...(options.confirmation ? { confirmation: options.confirmation } : {}),
      metadataProvider: options.metadataProvider,
    });
    mode = execution.provider.mode;
    synthesis = await synthesizeVoiceover(
      execution.provider,
      { runId: run.runId, text: preparation.text },
      {
        preparationDigest: preparation.evidence.output.sha256,
        binding: execution.binding,
        preflight: execution.preflight,
        approvedQuote: execution.approvedQuote,
        afterResultCommitted: options.afterResultCommitted,
        preparation: { evidence: preparation.evidence, evidenceText: preparation.evidenceText },
      },
    );
  }
  await options.afterSynthesis?.();
  return persistVoiceoverArtifacts({
    run,
    source,
    sourceText: voiceover,
    mode,
    preparation,
    synthesis,
    renderPlanDigest: renderPlan.digest,
  });
}

/**
 * Counts the whitespace-delimited words in a string.
 *
 * @param value - The text whose words to count
 * @returns The number of words in `value`
 */
function countWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}
