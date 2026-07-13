import { loadConfig } from "../config/config.js";
import { registerRunArtifactPath } from "../core/artifactRegistration.js";
import { registeredArtifactSetRevision } from "../core/artifactRevision.js";
import { artifactPath } from "../core/artifacts.js";
import { SafeExitError } from "../core/errors.js";
import { appendLedgerEvent } from "../core/ledger.js";
import { loadRun, mutateRun } from "../core/runStore.js";
import { requireState } from "../safeguards/approvalGuard.js";
import { writeJsonFile } from "../utils/json.js";
import { createId, nowIso } from "../utils/time.js";
import { verifyProductionPackage } from "./production/productionPackageIntegrity.js";
import { isVoiceSelectionArtifactPath } from "./voice/catalog/voiceAuditionContracts.js";
import {
  isVoiceCandidatesArtifactPath,
  isVoiceCatalogFailureArtifactPath,
  voiceCandidatesArtifactPath,
  voiceCandidatesSchema,
  voiceCatalogFailureArtifactPath,
  voiceCatalogFailureSchema,
  type VoiceCandidates,
  type VoiceCatalogFailure,
} from "./voice/catalog/voiceCatalogContracts.js";
import { canonicalVoiceEvidenceDigest } from "./voice/catalog/voiceCatalogDigest.js";
import type { VoiceCatalogProvider } from "./voice/catalog/voiceCatalogProvider.js";
import { VoiceCatalogProviderError } from "./voice/catalog/voiceCatalogProvider.js";
import { ElevenLabsVoiceCatalogProvider } from "./voice/providers/elevenLabsVoiceCatalogProvider.js";

type GenerateVoiceCandidatesOptions = { provider?: VoiceCatalogProvider };

/** Fetches and persists a redacted run-scoped ElevenLabs audition catalog. */
export async function generateVoiceCandidates(
  runId: string,
  options: GenerateVoiceCandidatesOptions = {},
): Promise<VoiceCandidates> {
  const config = await loadConfig();
  const run = await loadRun(runId);
  await requireState(run, "PRODUCTION_PACKAGE_GENERATED", "voice-candidates");
  const packageSnapshot = await verifyProductionPackage(run);
  const startingCatalogRevision = await voiceCatalogDependencyRevision(run);
  if (!config.providers.tts.enabled || config.providers.tts.mode !== "elevenlabs") {
    throw new SafeExitError(
      "Voice candidates require explicitly enabled ElevenLabs TTS configuration.",
    );
  }
  const provider = options.provider ?? new ElevenLabsVoiceCatalogProvider();
  const modelId = config.providers.tts.elevenLabs.modelId;
  let catalog: VoiceCandidates;
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
    catalog = voiceCandidatesSchema.parse({
      ...digestInput,
      catalogDigest: canonicalVoiceEvidenceDigest(digestInput),
    });
  } catch (error) {
    return recordCatalogFailure({
      runId,
      modelId,
      error,
      packageDigest: packageSnapshot.digest,
      startingRevision: startingCatalogRevision,
    });
  }

  const catalogPath = voiceCandidatesArtifactPath(createId("catalog"));
  await writeJsonFile(artifactPath(runId, catalogPath), catalog);
  await mutateRun(runId, async (current) => {
    await requireState(current, "PRODUCTION_PACKAGE_GENERATED", "voice-candidates");
    const currentPackage = await verifyProductionPackage(current);
    if (currentPackage.digest !== packageSnapshot.digest) {
      throw new SafeExitError(
        "Production package changed while the voice catalog request was in flight.",
      );
    }
    if ((await voiceCatalogDependencyRevision(current)) !== startingCatalogRevision) {
      throw new SafeExitError("Voice catalog evidence changed while the request was in flight.");
    }
    return { run: registerRunArtifactPath(current, catalogPath), value: undefined };
  });
  await appendArtifactWritten(runId, "voice-candidates", catalogPath);
  await appendLedgerEvent({
    runId,
    type: "GUARD_PASSED",
    stage: "voice-candidates",
    message: "Redacted ElevenLabs voice candidates recorded for operator audition.",
    data: {
      path: catalogPath,
      catalogDigest: catalog.catalogDigest,
      candidateCount: catalog.candidates.length,
      modelId: catalog.model.modelId,
      provider: catalog.provider,
    },
  });
  return catalog;
}

async function recordCatalogFailure(input: {
  runId: string;
  modelId: string;
  error: unknown;
  packageDigest: string;
  startingRevision: string;
}): Promise<never> {
  const failure = failureFor(input.runId, input.modelId, input.error);
  const failurePath = voiceCatalogFailureArtifactPath(createId("catalog_failure"));
  await writeJsonFile(artifactPath(input.runId, failurePath), failure);
  const mutation = await mutateRun(input.runId, async (current) => {
    const preserveCurrentEvidence =
      current.state !== "PRODUCTION_PACKAGE_GENERATED" ||
      (await voiceCatalogDependencyRevision(current)) !== input.startingRevision ||
      !(await hasMatchingProductionPackage(current, input.packageDigest));
    if (preserveCurrentEvidence) {
      return { run: current, value: true, persist: false };
    }
    return { run: registerRunArtifactPath(current, failurePath), value: false };
  });
  if (!mutation.value) {
    await appendArtifactWritten(input.runId, "voice-candidates", failurePath);
  }
  await appendLedgerEvent({
    runId: input.runId,
    type: "ERROR",
    stage: "voice-candidates",
    message: failure.message,
    data: {
      code: failure.code,
      provider: failure.provider,
      modelId: failure.modelId,
      diagnosticRecorded: !mutation.value,
      preservedNewerEvidence: mutation.value,
    },
  });
  throw new SafeExitError(`${failure.message} ${failure.nextAction}`);
}

async function voiceCatalogDependencyRevision(
  run: Awaited<ReturnType<typeof loadRun>>,
): Promise<string> {
  return registeredArtifactSetRevision(run, (relativePath) => {
    return (
      isVoiceCandidatesArtifactPath(relativePath) ||
      isVoiceCatalogFailureArtifactPath(relativePath) ||
      isVoiceSelectionArtifactPath(relativePath) ||
      relativePath.startsWith("production/audio/voice-previews/") ||
      relativePath.startsWith("production/audio/previews/") ||
      relativePath.startsWith("diagnostics/voice-preview-failures/") ||
      relativePath === "diagnostics/voice_preview_failure.json"
    );
  });
}

async function appendArtifactWritten(runId: string, stage: string, path: string): Promise<void> {
  await appendLedgerEvent({
    runId,
    type: "ARTIFACT_WRITTEN",
    stage,
    message: `Wrote ${path}.`,
    data: { path },
  });
}

async function hasMatchingProductionPackage(
  run: Awaited<ReturnType<typeof loadRun>>,
  expectedDigest: string,
): Promise<boolean> {
  try {
    return (await verifyProductionPackage(run)).digest === expectedDigest;
  } catch {
    return false;
  }
}

function failureFor(runId: string, modelId: string, error: unknown): VoiceCatalogFailure {
  const code = voiceCatalogFailureCode(error);
  return voiceCatalogFailureSchema.parse({
    schemaVersion: 1,
    runId,
    createdAt: nowIso(),
    provider: "elevenlabs",
    modelId,
    code,
    requestIdHashes: error instanceof VoiceCatalogProviderError ? error.requestIdHashes : [],
    message: "ElevenLabs voice catalog could not be recorded safely.",
    nextAction:
      code === "configuration"
        ? "Configure the server-only key and rerun voice-candidates."
        : "Inspect redacted diagnostics, verify provider access, and rerun voice-candidates.",
  });
}

function voiceCatalogFailureCode(error: unknown): VoiceCatalogFailure["code"] {
  if (error instanceof VoiceCatalogProviderError) return error.providerCode;
  if (error instanceof Error && error.message.includes("ELEVENLABS_API_KEY")) {
    return "configuration";
  }
  if (error instanceof SafeExitError) return "provider-response-invalid";
  return "provider-unavailable";
}
