import { loadConfig } from "../config/config.js";
import { removeRunArtifact, writeRunJson } from "../core/artifacts.js";
import { SafeExitError } from "../core/errors.js";
import { appendLedgerEvent } from "../core/ledger.js";
import { loadRun, saveRun } from "../core/runStore.js";
import { requireState } from "../safeguards/approvalGuard.js";
import { sha256 } from "../utils/hash.js";
import { nowIso } from "../utils/time.js";
import { verifyProductionPackage } from "./production/productionPackageIntegrity.js";
import {
  voiceCandidatesPath,
  voiceCandidatesSchema,
  voiceCatalogFailurePath,
  voiceCatalogFailureSchema,
  type VoiceCandidates,
  type VoiceCatalogFailure,
} from "./voice/catalog/voiceCatalogContracts.js";
import type { VoiceCatalogProvider } from "./voice/catalog/voiceCatalogProvider.js";
import { ElevenLabsVoiceCatalogProvider } from "./voice/providers/elevenLabsVoiceCatalogProvider.js";

type GenerateVoiceCandidatesOptions = { provider?: VoiceCatalogProvider };

/** Fetches and persists a redacted run-scoped ElevenLabs audition catalog. */
export async function generateVoiceCandidates(
  runId: string,
  options: GenerateVoiceCandidatesOptions = {},
): Promise<VoiceCandidates> {
  const config = await loadConfig();
  let run = await loadRun(runId);
  await requireState(run, "PRODUCTION_PACKAGE_GENERATED", "voice-candidates");
  await verifyProductionPackage(run);
  if (!config.providers.tts.enabled || config.providers.tts.mode !== "elevenlabs") {
    throw new SafeExitError(
      "Voice candidates require explicitly enabled ElevenLabs TTS configuration.",
    );
  }
  const provider = options.provider ?? new ElevenLabsVoiceCatalogProvider();
  const modelId = config.providers.tts.elevenLabs.modelId;
  try {
    provider.assertReady();
    const result = await provider.fetchCatalog({
      languageCode: config.providers.tts.elevenLabs.languageCode,
      maxCandidates: 24,
      maxCharactersPerRequest: config.providers.tts.elevenLabs.maxCharactersPerRequest,
      modelId,
      usdPerThousandCharacters: config.providers.tts.elevenLabs.usdPerThousandCharacters,
    });
    if (result.provider !== provider.provider || result.model.modelId !== modelId) {
      throw new SafeExitError("Voice catalog provider/model identity is inconsistent.");
    }
    const digestInput = { schemaVersion: 1 as const, runId: run.runId, ...result };
    const catalog = voiceCandidatesSchema.parse({
      ...digestInput,
      catalogDigest: sha256(JSON.stringify(digestInput)),
    });
    run = await removeRunArtifact(run, "voice-candidates", voiceCatalogFailurePath);
    run = await writeRunJson(run, "voice-candidates", voiceCandidatesPath, catalog);
    await saveRun(run);
    await appendLedgerEvent({
      runId: run.runId,
      type: "GUARD_PASSED",
      stage: "voice-candidates",
      message: "Redacted ElevenLabs voice candidates recorded for operator audition.",
      data: {
        catalogDigest: catalog.catalogDigest,
        candidateCount: catalog.candidates.length,
        modelId: catalog.model.modelId,
        provider: catalog.provider,
      },
    });
    return catalog;
  } catch (error) {
    const failure = failureFor(run.runId, modelId, error);
    run = await writeRunJson(run, "voice-candidates", voiceCatalogFailurePath, failure);
    await saveRun(run);
    await appendLedgerEvent({
      runId: run.runId,
      type: "ERROR",
      stage: "voice-candidates",
      message: failure.message,
      data: { code: failure.code, provider: failure.provider, modelId: failure.modelId },
    });
    throw new SafeExitError(`${failure.message} ${failure.nextAction}`);
  }
}

function failureFor(runId: string, modelId: string, error: unknown): VoiceCatalogFailure {
  const message = error instanceof Error ? error.message : "";
  const code: VoiceCatalogFailure["code"] = message.includes("ELEVENLABS_API_KEY")
    ? "configuration"
    : error instanceof SafeExitError
      ? "provider-response-invalid"
      : "provider-unavailable";
  return voiceCatalogFailureSchema.parse({
    schemaVersion: 1,
    runId,
    createdAt: nowIso(),
    provider: "elevenlabs",
    modelId,
    code,
    message: "ElevenLabs voice catalog could not be recorded safely.",
    nextAction:
      code === "configuration"
        ? "Configure the server-only key and rerun voice-candidates."
        : "Inspect redacted diagnostics, verify provider access, and rerun voice-candidates.",
  });
}
