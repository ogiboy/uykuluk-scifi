import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { loadConfig } from "../config/config.js";
import {
  artifactPath,
  recordRunArtifact,
  writeRunBinary,
  writeRunJson,
  writeRunText,
} from "../core/artifacts.js";
import { SafeExitError } from "../core/errors.js";
import { appendLedgerEvent } from "../core/ledger.js";
import { loadRun, saveRun } from "../core/runStore.js";
import { executeReservedProviderOperation } from "../costs/reservedProviderExecution.js";
import { requireApproval, requireState } from "../safeguards/approvalGuard.js";
import { nowIso } from "../utils/time.js";
import { verifyProductionPackage } from "./production/productionPackageIntegrity.js";
import { readRenderPlanEvidence } from "./renderPlan.js";
import { createTtsProvider } from "./voice/providers/createTtsProvider.js";
import type {
  TtsProvider,
  TtsSynthesisInput,
  TtsSynthesisResult,
} from "./voice/providers/ttsProvider.js";
import {
  VoiceoverAudioMeta,
  voiceoverAlignmentPath,
  voiceoverAudioMetaPath,
  voiceoverAudioMetaSchema,
  voiceoverAudioPath,
  voiceoverAudioReviewPath,
} from "./voice/voiceoverEvidence.js";
import {
  prepareVoiceoverText,
  voiceoverPreparationPath,
  voiceoverPreparedTextPath,
} from "./voice/voiceoverPreparation.js";
import { renderVoiceoverReviewMarkdown } from "./voice/voiceoverReviewMarkdown.js";

export async function generateVoiceoverAudio(runId: string): Promise<VoiceoverAudioMeta> {
  const config = await loadConfig();
  let run = await loadRun(runId);
  if (!config.providers.tts.enabled) {
    await appendLedgerEvent({
      runId: run.runId,
      type: "GUARD_BLOCKED",
      stage: "voice",
      message: "Voice/TTS is disabled until local TTS configuration is explicitly enabled.",
    });
    throw new SafeExitError("Voice/TTS is disabled and requires explicit local TTS configuration.");
  }

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

  const preparation = prepareVoiceoverText({
    runId: run.runId,
    sourceText: voiceover,
    pronunciationReplacements: config.providers.tts.pronunciationReplacements,
  });
  const provider = createTtsProvider(config.providers.tts);
  const synthesisInput = { runId: run.runId, text: preparation.text };
  const audio = await synthesizeVoiceover(provider, synthesisInput, {
    timeoutMs: config.providers.tts.elevenLabs.timeoutMs,
    operationBinding: {
      preparationDigest: preparation.evidence.output.sha256,
      providerMode: provider.mode,
    },
  });

  run = await writeRunText(run, "voice", voiceoverPreparedTextPath, preparation.text);
  run = await writeRunJson(run, "voice", voiceoverPreparationPath, preparation.evidence);

  if (audio.outputAlreadyPersisted) {
    run = await recordRunArtifact(run, "voice", voiceoverAudioPath);
  } else {
    run = await writeRunBinary(run, "voice", voiceoverAudioPath, audio.buffer);
  }

  const alignment = audio.alignment
    ? {
        path: voiceoverAlignmentPath,
        sha256: createHash("sha256")
          .update(`${JSON.stringify(audio.alignment, null, 2)}\n`, "utf8")
          .digest("hex"),
        characterCount: audio.alignment.characters.length,
      }
    : undefined;
  if (audio.alignment) {
    run = await writeRunJson(run, "voice", voiceoverAlignmentPath, audio.alignment);
  }

  const digest = createHash("sha256").update(audio.buffer).digest("hex");
  const meta = voiceoverAudioMetaSchema.parse({
    schemaVersion: 1,
    runId: run.runId,
    createdAt: nowIso(),
    mode: provider.mode,
    quality: audio.quality,
    source: {
      ...source,
      preparation: {
        path: voiceoverPreparedTextPath,
        sha256: preparation.evidence.output.sha256,
        metadataPath: voiceoverPreparationPath,
        metadataSha256: createHash("sha256").update(preparation.evidenceText, "utf8").digest("hex"),
        replacementsApplied: preparation.evidence.replacements.length,
      },
    },
    renderPlan: { path: "production/render_plan.json", digest: renderPlan.digest },
    output: {
      path: voiceoverAudioPath,
      sha256: digest,
      bytes: audio.buffer.byteLength,
      durationSeconds: audio.durationSeconds,
      sampleRateHz: audio.sampleRateHz,
      channels: audio.channels,
    },
    provider: audio.provider,
    processing: audio.processing,
    alignment,
  });
  run = await writeRunJson(run, "voice", voiceoverAudioMetaPath, meta);
  run = await writeRunText(
    run,
    "voice",
    voiceoverAudioReviewPath,
    renderVoiceoverReviewMarkdown(meta),
  );
  await saveRun(run);
  return meta;
}

async function synthesizeVoiceover(
  provider: TtsProvider,
  input: TtsSynthesisInput,
  options: {
    timeoutMs: number;
    operationBinding: { preparationDigest: string; providerMode: string };
  },
): Promise<TtsSynthesisResult> {
  if (provider.executionPolicy === "local") {
    return provider.synthesize(input);
  }
  provider.assertReady();
  const operationId = `tts_${createHash("sha256")
    .update(
      JSON.stringify({
        runId: input.runId,
        textDigest: createHash("sha256").update(input.text, "utf8").digest("hex"),
        ...options.operationBinding,
      }),
      "utf8",
    )
    .digest("hex")}`;
  const result = await executeReservedProviderOperation({
    runId: input.runId,
    stage: "tts",
    operationId,
    timeoutMs: options.timeoutMs,
    adapter: provider.createReservedAdapter(input),
  });
  if (result.status === "completed") {
    return result.value;
  }
  if (result.status === "definitely-not-sent") {
    throw new SafeExitError(
      "ElevenLabs TTS was not sent; repair provider configuration and create a fresh cost quote before retrying.",
    );
  }
  throw new SafeExitError(
    "ElevenLabs TTS reservation requires reconciliation before retry; automatic duplicate generation is blocked.",
  );
}

function countWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}
